import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { paymentGatewayService } from "./payment-gateway.service.js";
import {
  paymentGatewayConfigCreateSchema,
  paymentGatewayConfigUpdateSchema,
  paymentGatewayTransactionCreateSchema,
  paymentGatewayConfigSchema,
  paymentGatewayTransactionSchema,
} from "./payment-gateway.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerPaymentGatewaysController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleConfigResponse = z.object({ success: z.literal(true), data: paymentGatewayConfigSchema });
  const singleTransactionResponse = z.object({ success: z.literal(true), data: paymentGatewayTransactionSchema });

  // ── Gateway Configs ──

  typed.get("/payment-gateways", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:read"]),
    schema: {
      description: "List payment gateway configs",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(paymentGatewayConfigSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await paymentGatewayService.listConfigs(options);
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/payment-gateways/:id", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:read"]),
    schema: {
      description: "Get payment gateway config by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleConfigResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await paymentGatewayService.getConfigById(id));
  });

  typed.post("/payment-gateways", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:create"]),
    schema: {
      description: "Create a payment gateway config",
      security: [{ bearerAuth: [] }],
      body: paymentGatewayConfigCreateSchema,
      response: { 201: singleConfigResponse },
    },
  }, async (request, reply) => {
    const config = await paymentGatewayService.createConfig(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(config);
  });

  typed.patch("/payment-gateways/:id", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:update"]),
    schema: {
      description: "Update a payment gateway config",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: paymentGatewayConfigUpdateSchema,
      response: { 200: singleConfigResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await paymentGatewayService.updateConfig(id, request.body as any, getAuditContext(request)));
  });

  typed.delete("/payment-gateways/:id", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:delete"]),
    schema: {
      description: "Delete a payment gateway config",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await paymentGatewayService.deleteConfig(id, getAuditContext(request)));
  });

  // ── Transactions ──

  typed.post("/payment-gateways/transactions", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:create"]),
    schema: {
      description: "Create a payment gateway transaction",
      security: [{ bearerAuth: [] }],
      body: paymentGatewayTransactionCreateSchema,
      response: { 201: singleTransactionResponse },
    },
  }, async (request, reply) => {
    const transaction = await paymentGatewayService.createTransaction(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(transaction);
  });

  typed.get("/payment-gateways/transactions", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:read"]),
    schema: {
      description: "List payment gateway transactions",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        status: z.string().optional(),
        gatewayConfigId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(paymentGatewayTransactionSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const filters: Record<string, string[]> = {};
    if (query.status) filters.status = [String(query.status)];
    if (query.gatewayConfigId) filters.gatewayConfigId = [String(query.gatewayConfigId)];
    const result = await paymentGatewayService.listTransactions({ ...options, filters });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/payment-gateways/transactions/:id", {
    preHandler: requirePermission(PERMISSIONS["payment-gateways:read"]),
    schema: {
      description: "Get payment gateway transaction by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleTransactionResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await paymentGatewayService.getTransactionById(id));
  });
}
