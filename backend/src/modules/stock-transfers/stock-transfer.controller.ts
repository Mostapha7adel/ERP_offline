import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { stockTransferService } from "./stock-transfer.service.js";
import { stockTransferCreateSchema, stockTransferUpdateSchema, stockTransferSchema } from "./stock-transfer.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerStockTransfersController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: stockTransferSchema });

  typed.get("/stock-transfers", {
    preHandler: requirePermission(PERMISSIONS["stock-transfers:read"]),
    schema: {
      description: "List stock transfers",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(stockTransferSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await stockTransferService.list(options);
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/stock-transfers/:id", {
    preHandler: requirePermission(PERMISSIONS["stock-transfers:read"]),
    schema: {
      description: "Get stock transfer by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await stockTransferService.getById(id));
  });

  typed.post("/stock-transfers", {
    preHandler: requirePermission(PERMISSIONS["stock-transfers:create"]),
    schema: {
      description: "Create a stock transfer",
      security: [{ bearerAuth: [] }],
      body: stockTransferCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const transfer = await stockTransferService.create(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(transfer);
  });

  typed.patch("/stock-transfers/:id", {
    preHandler: requirePermission(PERMISSIONS["stock-transfers:update"]),
    schema: {
      description: "Update a stock transfer",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: stockTransferUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await stockTransferService.update(id, request.body as any, getAuditContext(request)));
  });

  typed.post("/stock-transfers/:id/complete", {
    preHandler: requirePermission(PERMISSIONS["stock-transfers:update"]),
    schema: {
      description: "Complete a stock transfer (moves inventory)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await stockTransferService.complete(id, getAuditContext(request)));
  });

  typed.post("/stock-transfers/:id/cancel", {
    preHandler: requirePermission(PERMISSIONS["stock-transfers:update"]),
    schema: {
      description: "Cancel a stock transfer",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await stockTransferService.cancel(id, getAuditContext(request)));
  });

  typed.delete("/stock-transfers/:id", {
    preHandler: requirePermission(PERMISSIONS["stock-transfers:delete"]),
    schema: {
      description: "Delete a stock transfer",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await stockTransferService.delete(id, getAuditContext(request)));
  });
}
