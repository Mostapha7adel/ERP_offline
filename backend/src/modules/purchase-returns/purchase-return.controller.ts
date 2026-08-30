import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { purchaseReturnService } from "./purchase-return.service.js";
import { purchaseReturnCreateSchema, purchaseReturnUpdateSchema, purchaseReturnSchema } from "./purchase-return.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerPurchaseReturnsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: purchaseReturnSchema });

  typed.get("/purchase-returns", {
    preHandler: requirePermission(PERMISSIONS["purchase-returns:read"]),
    schema: {
      description: "List purchase returns",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        supplierId: z.string().optional(),
        invoiceId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const filters: Record<string, string[]> = {};
    if (query.supplierId) filters.supplierId = [String(query.supplierId)];
    if (query.invoiceId) filters.invoiceId = [String(query.invoiceId)];
    const result = await purchaseReturnService.list({ ...options, filters });
    return paginated(await Promise.all(result.items.map((r) => purchaseReturnService.enrich(r))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/purchase-returns/:id", {
    preHandler: requirePermission(PERMISSIONS["purchase-returns:read"]),
    schema: {
      description: "Get a purchase return by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await purchaseReturnService.enrich(await purchaseReturnService.getById(id)));
  });

  typed.post("/purchase-returns", {
    preHandler: requirePermission(PERMISSIONS["purchase-returns:create"]),
    schema: {
      description: "Create a purchase return (reverses stock, adjusts invoice)",
      security: [{ bearerAuth: [] }],
      body: purchaseReturnCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const record = await purchaseReturnService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await purchaseReturnService.enrich(record));
  });

  typed.patch("/purchase-returns/:id", {
    preHandler: requirePermission(PERMISSIONS["purchase-returns:update"]),
    schema: {
      description: "Update a purchase return",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: purchaseReturnUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const record = await purchaseReturnService.update(id, request.body, getAuditContext(request));
    return ok(await purchaseReturnService.enrich(record));
  });

  typed.post("/purchase-returns/:id/void", {
    preHandler: requirePermission(PERMISSIONS["purchase-returns:update"]),
    schema: {
      description: "Void a purchase return (reverses stock and invoice adjustments)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await purchaseReturnService.enrich(await purchaseReturnService.void(id, getAuditContext(request))));
  });

  typed.delete("/purchase-returns/:id", {
    preHandler: requirePermission(PERMISSIONS["purchase-returns:delete"]),
    schema: {
      description: "Delete a purchase return",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await purchaseReturnService.delete(id, getAuditContext(request)));
  });
}
