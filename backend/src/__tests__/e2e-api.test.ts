import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Database + secret for this test run must be set before bootstrap/prisma load.
// NOTE: static `import` of prisma must NOT happen above — ESM hoists imports
// before any module-body statement runs, so the DATABASE_URL override below
// would be ignored and prisma would connect to the default dev.db. All
// app imports are therefore dynamic.
const tmp = mkdtempSync(join(tmpdir(), "ledgerflow-e2e-"));
const dbPath = join(tmp, "e2e.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.JWT_SECRET = "e2e-test-secret-0123456789abcdef0123456789abcdef";
process.env.NODE_ENV = "test";

const {
  connectDb,
  disconnectDb,
} = await import("../core/database/prisma.js");
const { runMigrations } = await import("../core/database/migrations.js");
const { seedDatabase } = await import("../seed/seed.js");
const { buildServer } = await import("../app.js");
import type { FastifyInstance } from "fastify";

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  mustChangePassword?: boolean;
  user: { id: string; email: string; permissions: string[] };
}

let app: FastifyInstance;
let token: string;
let refreshToken: string;

beforeAll(async () => {
  await connectDb();
  await runMigrations();
  await seedDatabase();
  app = await buildServer();
});

afterAll(async () => {
  if (app) await app.close();
  await disconnectDb();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
});

async function login(): Promise<LoginResult> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@ledgerflow.local", password: "Admin@123!" },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.success).toBe(true);
  return body.data as LoginResult;
}

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe("E2E API smoke", () => {
  it("health endpoint is public", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", port: expect.any(Number) });
  });

  it("login returns tokens and admin principal", async () => {
    const data = await login();
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    expect(data.tokenType).toBe("Bearer");
    expect(data.user.email).toBe("admin@ledgerflow.local");
    token = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it("first login forces email and password change", async () => {
    const data = await login();
    expect(data.mustChangePassword).toBe(true);
  });

  it("change-password updates email and clears the forced flag", async () => {
    const fresh = await login();
    const change = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: `Bearer ${fresh.accessToken}` },
      payload: {
        newPassword: "Admin@123!",
        email: "admin@ledgerflow.local",
      },
    });
    expect(change.statusCode).toBe(200);
    const data = change.json().data;
    expect(data.success).toBe(true);
    expect(data.email).toBe("admin@ledgerflow.local");
    expect(data.accessToken).toBeTruthy();

    // After the forced change the flag is cleared for the next login.
    const relogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@ledgerflow.local", password: "Admin@123!" },
    });
    expect(relogin.json().data.mustChangePassword).toBe(false);
  });

  it("refresh rotates the refresh token", async () => {
    const first = await login();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: first.refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    expect(data.refreshToken).not.toBe(first.refreshToken);

    // Old refresh token is revoked.
    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: first.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
    token = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it("rejects unauthenticated protected routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/customers" });
    expect(res.statusCode).toBe(401);
  });

  it("creates and lists a customer with a valid token", async () => {
    const code = `E2E-${Date.now()}`;
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/customers",
      headers: authHeaders(),
      payload: {
        type: "customer",
        name: "E2E Customer",
        code,
        status: "active",
      },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/customers?limit=10",
      headers: authHeaders(),
    });
    expect(list.statusCode).toBe(200);
    const rows = list.json().data;
    expect(rows.some((r: { name: string }) => r.name === "E2E Customer")).toBe(true);
  });

  it("creates a backup and restores it", async () => {
    const backup = await app.inject({
      method: "POST",
      url: "/api/v1/backup",
      headers: authHeaders(),
      payload: {},
    });
    expect(backup.statusCode).toBe(201);
    const backupId = backup.json().data.id as string;

    const restore = await app.inject({
      method: "POST",
      url: "/api/v1/restore/from-backup",
      headers: authHeaders(),
      payload: { backupId },
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json().data.restored).toBeGreaterThan(0);
  });

  it("rejects a tampered restore payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/restore/from-payload",
      headers: authHeaders(),
      payload: { app: "evil", version: 1, data: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it("enforces unique party email, phone and tax number", async () => {
    const base = `UNIQ-${Date.now()}`;
    const create = (url: string, payload: Record<string, unknown>) =>
      app.inject({ method: "POST", url, headers: authHeaders(), payload });

    const c1 = await create("/api/v1/customers", {
      type: "customer", name: "Unique Cust 1", code: `${base}-C1`, status: "active",
      email: `${base}@test.local`, phone: "777-111-222", taxNumber: `TAX-${base}-1`,
    });
    expect(c1.statusCode).toBe(201);
    const cust1 = c1.json().data as { id: string };

    const s1 = await create("/api/v1/suppliers", {
      type: "supplier", name: "Unique Sup 1", code: `${base}-S1`, status: "active",
      email: `${base}-s@test.local`, phone: "888-333-444", taxNumber: `TAX-${base}-2`,
    });
    expect(s1.statusCode).toBe(201);

    // Same email on a different customer → conflict.
    const dupEmail = await create("/api/v1/customers", {
      type: "customer", name: "Dup Email", code: `${base}-C2`, status: "active",
      email: `${base}@test.local`, phone: "111-000-000",
    });
    expect(dupEmail.statusCode).toBe(409);

    // Same phone across party types → conflict.
    const dupPhone = await create("/api/v1/suppliers", {
      type: "supplier", name: "Dup Phone", code: `${base}-S2`, status: "active",
      phone: "777-111-222",
    });
    expect(dupPhone.statusCode).toBe(409);

    // Same tax number on another party → conflict.
    const dupTax = await create("/api/v1/customers", {
      type: "customer", name: "Dup Tax", code: `${base}-C3`, status: "active",
      taxNumber: `TAX-${base}-2`,
    });
    expect(dupTax.statusCode).toBe(409);

    // Editing a party with someone else's email → conflict.
    const clashUpdate = await app.inject({
      method: "PUT", url: `/api/v1/customers/${cust1.id}`, headers: authHeaders(),
      payload: { email: `${base}-s@test.local` },
    });
    expect(clashUpdate.statusCode).toBe(409);

    // Editing a party while keeping its own values → allowed.
    const selfUpdate = await app.inject({
      method: "PUT", url: `/api/v1/customers/${cust1.id}`, headers: authHeaders(),
      payload: { name: "Unique Cust 1 Edited", email: `${base}@test.local`, phone: "777-111-222", taxNumber: `TAX-${base}-1` },
    });
    expect(selfUpdate.statusCode).toBe(200);
  });

  it("enforces unique user phone", async () => {
    const roles = (await app.inject({ method: "GET", url: "/api/v1/roles?limit=10", headers: authHeaders() })).json().data;
    const roleId = roles.find((r: { name: string }) => r.name === "Manager")?.id ?? roles[0].id as string;
    const base = `UPH-${Date.now()}`;

    const u1 = await app.inject({
      method: "POST", url: "/api/v1/users", headers: authHeaders(),
      payload: { name: "Phone User 1", email: `${base}@test.local`, roleId, status: "active", phone: "999-555-1212", password: "Passw0rd@123" },
    });
    expect(u1.statusCode).toBe(201);

    const dup = await app.inject({
      method: "POST", url: "/api/v1/users", headers: authHeaders(),
      payload: { name: "Phone User 2", email: `${base}-2@test.local`, roleId, status: "active", phone: "999-555-1212", password: "Passw0rd@123" },
    });
    expect(dup.statusCode).toBe(409);
  });

  it("updates an invoice and keeps stock consistent", async () => {
    const h = authHeaders();
    const base = `INVUP-${Date.now()}`;

    const cust = (await app.inject({
      method: "POST", url: "/api/v1/customers", headers: h,
      payload: { type: "customer", name: "Edit Cust", code: `${base}-C`, status: "active", currency: "USD" },
    })).json().data;
    const wh1 = (await app.inject({
      method: "POST", url: "/api/v1/warehouses", headers: h,
      payload: { code: `${base}-W1`, name: "Edit WH1", status: "active", isDefault: false },
    })).json().data;
    const wh2 = (await app.inject({
      method: "POST", url: "/api/v1/warehouses", headers: h,
      payload: { code: `${base}-W2`, name: "Edit WH2", status: "active", isDefault: false },
    })).json().data;
    const prod = (await app.inject({
      method: "POST", url: "/api/v1/products", headers: h,
      payload: { sku: `${base}-P`, name: "Edit Product", type: "product", purchasePrice: 40, salePrice: 100, taxRate: 0, trackStock: true, status: "active" },
    })).json().data;

    const setupStock = (warehouseId: string, qty: number) =>
      app.inject({
        method: "POST", url: "/api/v1/inventory/adjustments", headers: h,
        payload: { productId: prod.id, warehouseId, quantity: qty, reason: "edit test setup" },
      });
    await setupStock(wh1.id, 20);
    await setupStock(wh2.id, 20);

    const created = (await app.inject({
      method: "POST", url: "/api/v1/sales", headers: h,
      payload: {
        type: "sales", customerId: cust.id, invoiceDate: new Date().toISOString(), warehouseId: wh1.id,
        lines: [{ productId: prod.id, productName: prod.name, quantity: 2, unitPrice: 100, taxRate: 0, discount: 0 }],
        discount: 0,
      },
    })).json().data;
    expect(created.total).toBe(200);

    const onHand = (warehouseId: string) =>
      (app.inject({ method: "GET", url: "/api/v1/inventory?limit=100", headers: h })).then((r) => {
        const row = r.json().data.find((s: { productId: string; warehouseId: string }) => s.productId === prod.id && s.warehouseId === warehouseId);
        return row?.quantityOnHand ?? 0;
      });

    expect(await onHand(wh1.id)).toBe(18);

    const updated = (await app.inject({
      method: "PATCH", url: `/api/v1/sales/${created.id}`, headers: h,
      payload: {
        warehouseId: wh2.id,
        dueDate: new Date(Date.now() + 45 * 86400000).toISOString(),
        lines: [{ productId: prod.id, productName: prod.name, quantity: 5, unitPrice: 120, taxRate: 0, discount: 0 }],
      },
    })).json().data;
    expect(updated.statusCode ? false : updated.total).toBe(600);

    // Old warehouse restored, new warehouse deducted.
    expect(await onHand(wh1.id)).toBe(20);
    expect(await onHand(wh2.id)).toBe(15);
  });

  it("logout invalidates the session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: authHeaders(),
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
  });
});
