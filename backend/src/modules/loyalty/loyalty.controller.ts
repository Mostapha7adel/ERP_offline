import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { loyaltyService } from "./loyalty.service.js";
import { loyaltyAccountSchema, loyaltyTransactionSchema, loyaltyEarnSchema, loyaltyRedeemSchema, loyaltyAdjustSchema } from "./loyalty.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerLoyaltyController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: loyaltyAccountSchema });

  typed.get("/loyalty/accounts", {
    preHandler: requirePermission(PERMISSIONS["loyalty:read"]),
    schema: {
      description: "List loyalty accounts",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(loyaltyAccountSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await loyaltyService.listAccounts(options);
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/loyalty/accounts/:partyId", {
    preHandler: requirePermission(PERMISSIONS["loyalty:read"]),
    schema: {
      description: "Get loyalty account for a party",
      security: [{ bearerAuth: [] }],
      params: z.object({ partyId: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { partyId } = request.params as { partyId: string };
    const account = await loyaltyService.getAccount(partyId);
    return ok(account);
  });

  typed.post("/loyalty/earn", {
    preHandler: requirePermission(PERMISSIONS["loyalty:create"]),
    schema: {
      description: "Earn loyalty points for a customer",
      security: [{ bearerAuth: [] }],
      body: loyaltyEarnSchema,
      response: { 201: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request, reply) => {
    const result = await loyaltyService.earn(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(result);
  });

  typed.post("/loyalty/redeem", {
    preHandler: requirePermission(PERMISSIONS["loyalty:redeem"]),
    schema: {
      description: "Redeem loyalty points for a discount",
      security: [{ bearerAuth: [] }],
      body: loyaltyRedeemSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const result = await loyaltyService.redeem(request.body as any, getAuditContext(request));
    return ok(result);
  });

  typed.post("/loyalty/adjust", {
    preHandler: requirePermission(PERMISSIONS["loyalty:update"]),
    schema: {
      description: "Manually adjust loyalty points (positive or negative)",
      security: [{ bearerAuth: [] }],
      body: loyaltyAdjustSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const result = await loyaltyService.adjust(request.body as any, getAuditContext(request));
    return ok(result);
  });

  typed.get("/loyalty/transactions", {
    preHandler: requirePermission(PERMISSIONS["loyalty:read"]),
    schema: {
      description: "List loyalty transactions",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(loyaltyTransactionSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await loyaltyService.listTransactions(options);
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/loyalty/accounts/:partyId/transactions", {
    preHandler: requirePermission(PERMISSIONS["loyalty:read"]),
    schema: {
      description: "Get transaction history for a loyalty account",
      security: [{ bearerAuth: [] }],
      params: z.object({ partyId: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(loyaltyTransactionSchema) }) },
    },
  }, async (request) => {
    const { partyId } = request.params as { partyId: string };
    const account = await loyaltyService.getAccount(partyId);
    const transactions = await loyaltyService.getTransactionsByAccount(account.id);
    return ok(transactions);
  });

  typed.delete("/loyalty/accounts/:id", {
    preHandler: requirePermission(PERMISSIONS["loyalty:delete"]),
    schema: {
      description: "Delete a loyalty account",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await loyaltyService.deleteAccount(id, getAuditContext(request)));
  });
}
