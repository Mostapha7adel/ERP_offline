import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { accountingService } from "./accounting.service.js";
import { accountSchema, journalSchema, accountCreateSchema, accountUpdateSchema, journalCreateSchema } from "./accounting.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerAccountingController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ---- Chart of accounts ----

  typed.get("/accounting/accounts", {
    preHandler: requirePermission(PERMISSIONS["accounting:read"]),
    schema: {
      description: "List chart of accounts with computed balances",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional(), search: z.string().optional(), type: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()), meta: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 20);
    const result = await accountingService.listAccounts({
      page,
      limit,
      search: q.search ? String(q.search) : undefined,
      type: q.type ? String(q.type) : undefined,
    });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/accounting/chart", {
    preHandler: requirePermission(PERMISSIONS["accounting:read"]),
    schema: {
      description: "Full chart of accounts with balances (no pagination)",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()) }) },
    },
  }, async () => {
    return ok(await accountingService.getChart());
  });

  typed.post("/accounting/accounts", {
    preHandler: requirePermission(PERMISSIONS["accounting:create"]),
    schema: {
      description: "Create an account in the chart of accounts",
      security: [{ bearerAuth: [] }],
      body: accountCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: accountSchema }) },
    },
  }, async (request, reply) => {
    const account = await accountingService.createAccount(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(account);
  });

  typed.put("/accounting/accounts/:id", {
    preHandler: requirePermission(PERMISSIONS["accounting:update"]),
    schema: {
      description: "Update an account",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: accountUpdateSchema,
      response: { 200: z.object({ success: z.literal(true), data: accountSchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await accountingService.updateAccount(id, request.body, getAuditContext(request)));
  });

  typed.delete("/accounting/accounts/:id", {
    preHandler: requirePermission(PERMISSIONS["accounting:delete"]),
    schema: {
      description: "Delete an account",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await accountingService.deleteAccount(id, getAuditContext(request)));
  });

  // ---- Journal entries ----

  typed.get("/accounting/journals", {
    preHandler: requirePermission(PERMISSIONS["accounting:read"]),
    schema: {
      description: "List journal entries",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional(), search: z.string().optional(), status: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(journalSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 20);
    const result = await accountingService.listJournals({
      page,
      limit,
      search: q.search ? String(q.search) : undefined,
      status: q.status ? String(q.status) : undefined,
    });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.post("/accounting/journals", {
    preHandler: requirePermission(PERMISSIONS["accounting:create"]),
    schema: {
      description: "Create a balanced double-entry journal entry",
      security: [{ bearerAuth: [] }],
      body: journalCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: journalSchema }) },
    },
  }, async (request, reply) => {
    const entry = await accountingService.createJournal(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(entry);
  });

  typed.get("/accounting/journals/:id", {
    preHandler: requirePermission(PERMISSIONS["accounting:read"]),
    schema: {
      description: "Get a journal entry",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: journalSchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await accountingService.getJournal(id));
  });

  typed.post("/accounting/journals/:id/void", {
    preHandler: requirePermission(PERMISSIONS["accounting:update"]),
    schema: {
      description: "Void a journal entry",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: journalSchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await accountingService.voidJournal(id, getAuditContext(request)));
  });

  typed.get("/accounting/ledger/:accountCode", {
    preHandler: requirePermission(PERMISSIONS["accounting:read"]),
    schema: {
      description: "General ledger for an account with running balance",
      security: [{ bearerAuth: [] }],
      params: z.object({ accountCode: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { accountCode } = request.params as { accountCode: string };
    return ok(await accountingService.getLedger(accountCode));
  });

  typed.get("/accounting/trial-balance", {
    preHandler: requirePermission(PERMISSIONS["accounting:read"]),
    schema: {
      description: "Trial balance (debits vs credits), optionally scoped to a fiscal year",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ fiscalYearId: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { fiscalYearId } = request.query as Record<string, unknown>;
    return ok(await accountingService.getTrialBalance(fiscalYearId ? String(fiscalYearId) : undefined));
  });
}
