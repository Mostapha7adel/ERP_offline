import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { treasuryService } from "./treasury.service.js";
import { accountSchema, transactionSchema, accountCreateSchema, accountUpdateSchema, transactionCreateSchema, transferSchema } from "./treasury.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerTreasuryController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/treasury/accounts", {
    preHandler: requirePermission(PERMISSIONS["treasury:read"]),
    schema: {
      description: "List treasury accounts",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional(), search: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(accountSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 20);
    const result = await treasuryService.listAccounts({ page, limit, search: q.search ? String(q.search) : undefined });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/treasury/accounts/:id", {
    preHandler: requirePermission(PERMISSIONS["treasury:read"]),
    schema: {
      description: "Get a treasury account with running-balance statement",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await treasuryService.getStatement(id));
  });

  typed.post("/treasury/accounts", {
    preHandler: requirePermission(PERMISSIONS["treasury:create"]),
    schema: {
      description: "Create a treasury account",
      security: [{ bearerAuth: [] }],
      body: accountCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: accountSchema }) },
    },
  }, async (request, reply) => {
    const account = await treasuryService.createAccount(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(account);
  });

  typed.put("/treasury/accounts/:id", {
    preHandler: requirePermission(PERMISSIONS["treasury:update"]),
    schema: {
      description: "Update a treasury account",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: accountUpdateSchema,
      response: { 200: z.object({ success: z.literal(true), data: accountSchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await treasuryService.updateAccount(id, request.body, getAuditContext(request)));
  });

  typed.delete("/treasury/accounts/:id", {
    preHandler: requirePermission(PERMISSIONS["treasury:delete"]),
    schema: {
      description: "Delete a treasury account",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await treasuryService.deleteAccount(id, getAuditContext(request)));
  });

  typed.get("/treasury/transactions", {
    preHandler: requirePermission(PERMISSIONS["treasury:read"]),
    schema: {
      description: "List treasury transactions",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional(), accountId: z.string().optional(), type: z.string().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(transactionSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const result = await treasuryService.listTransactions({
      page: Number(q.page ?? 1),
      limit: Number(q.limit ?? 20),
      accountId: q.accountId ? String(q.accountId) : undefined,
      type: q.type ? String(q.type) : undefined,
    });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.post("/treasury/transactions", {
    preHandler: requirePermission(PERMISSIONS["treasury:create"]),
    schema: {
      description: "Record an income or expense transaction",
      security: [{ bearerAuth: [] }],
      body: transactionCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: transactionSchema }) },
    },
  }, async (request, reply) => {
    const txn = await treasuryService.createTransaction(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(txn);
  });

  typed.delete("/treasury/transactions/:id", {
    preHandler: requirePermission(PERMISSIONS["treasury:delete"]),
    schema: {
      description: "Delete a treasury transaction and reverse its balance impact",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await treasuryService.deleteTransaction(id, getAuditContext(request)));
  });

  typed.post("/treasury/transfers", {
    preHandler: requirePermission(PERMISSIONS["treasury:create"]),
    schema: {
      description: "Transfer funds between accounts",
      security: [{ bearerAuth: [] }],
      body: transferSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) }) },
    },
  }, async (request) => {
    return ok(await treasuryService.transfer(request.body, getAuditContext(request)));
  });

  typed.get("/treasury/summary", {
    preHandler: requirePermission(PERMISSIONS["treasury:read"]),
    schema: {
      description: "Treasury summary (balances, income, expense)",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async () => {
    return ok(await treasuryService.getSummary());
  });
}
