import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "ledgerflow-void-"));
const dbPath = join(tmp, "void.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.JWT_SECRET = "void-test-secret-0123456789abcdef0123456789abcdef";
process.env.NODE_ENV = "test";

const { connectDb, disconnectDb } = await import("../core/database/prisma.js");
const { runMigrations } = await import("../core/database/migrations.js");
const { seedDatabase } = await import("../seed/seed.js");
const { buildServer } = await import("../app.js");
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  await connectDb();
  await runMigrations();
  await seedDatabase();
  app = await buildServer();
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@ledgerflow.local", password: "Admin@123!" },
  });
  token = res.json().data.accessToken;
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/change-password",
    headers: { authorization: `Bearer ${token}` },
    payload: { currentPassword: "Admin@123!", newPassword: "Admin@123!", email: "admin@ledgerflow.local" },
  });
});

afterAll(async () => {
  if (app) await app.close();
  await disconnectDb();
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
});

describe("sale void restores stock", () => {
  it("creates a sale with warehouse, verifies stock drop, voids, verifies stock return", async () => {
    const h = { authorization: `Bearer ${token}` };

    // Seed a customer, warehouse, product with stock via the API
    const cust = await app.inject({
      method: "POST", url: "/api/v1/customers", headers: h,
      payload: { type: "customer", name: "Void Test Cust", code: `VTC-${Date.now()}`, status: "active", currency: "USD" },
    });
    expect(cust.statusCode).toBe(201);
    const customer = cust.json().data;

    const wh = await app.inject({
      method: "POST", url: "/api/v1/warehouses", headers: h,
      payload: { code: `WHV-${Date.now()}`, name: "Void WH", status: "active", isDefault: false },
    });
    expect(wh.statusCode).toBe(201);
    const warehouse = wh.json().data;

    const prod = await app.inject({
      method: "POST", url: "/api/v1/products", headers: h,
      payload: { sku: `SKUV-${Date.now()}`, name: "Void Product", type: "product", purchasePrice: 50, salePrice: 100, taxRate: 0, trackStock: true, status: "active" },
    });
    expect(prod.statusCode).toBe(201);
    const product = prod.json().data;

    // Add stock
    const adj = await app.inject({
      method: "POST", url: "/api/v1/inventory/adjustments", headers: h,
      payload: { productId: product.id, warehouseId: warehouse.id, quantity: 10, reason: "test setup" },
    });
    expect(adj.statusCode).toBe(200);
    expect(adj.json().data.newQuantity).toBe(10);

    const stockBefore = (await app.inject({ method: "GET", url: "/api/v1/inventory?limit=100", headers: h })).json().data;
    const siBefore = stockBefore.find((s: any) => s.productId === product.id && s.warehouseId === warehouse.id);
    expect(siBefore.quantityOnHand).toBe(10);

    const create = await app.inject({
      method: "POST",
      url: "/api/v1/sales",
      headers: h,
      payload: {
        type: "sales",
        customerId: customer.id,
        invoiceDate: new Date().toISOString(),
        warehouseId: warehouse.id,
        lines: [{ productId: product.id, productName: product.name, quantity: 3, unitPrice: 100, taxRate: 0, discount: 0 }],
        discount: 0,
      },
    });
    expect(create.statusCode).toBe(201);
    const sale = create.json().data;

    const stockAfterSale = (await app.inject({ method: "GET", url: "/api/v1/inventory?limit=100", headers: h })).json().data;
    const siAfter = stockAfterSale.find((s: any) => s.productId === product.id && s.warehouseId === warehouse.id);
    expect(siAfter.quantityOnHand).toBe(7);

    // Create a cash account so payment recording succeeds
    const acct = await app.inject({
      method: "POST", url: "/api/v1/treasury/accounts", headers: h,
      payload: { name: "Test Cash", type: "cash", currency: "USD", openingBalance: 0 },
    });
    expect(acct.statusCode).toBe(201);

    // Pay it
    const pay = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${sale.id}/pay`,
      headers: h,
      payload: { amount: 300, method: "cash" },
    });
    expect(pay.statusCode).toBe(200);
    expect(pay.json().data.paidAmount).toBe(300);

    // Void it
    const voidRes = await app.inject({
      method: "POST",
      url: `/api/v1/sales/${sale.id}/void`,
      headers: h,
    });
    expect(voidRes.statusCode).toBe(200);
    expect(voidRes.json().data.status).toBe("void");

    const stockAfterVoid = (await app.inject({ method: "GET", url: "/api/v1/inventory?limit=100", headers: h })).json().data;
    const siFinal = stockAfterVoid.find((s: any) => s.productId === product.id && s.warehouseId === warehouse.id);
    expect(siFinal.quantityOnHand).toBe(10);
  });
});
