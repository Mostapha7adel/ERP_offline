import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { salesReturnService } from "./sales-return.service.js";
import { salesReturnCreateSchema, salesReturnUpdateSchema, salesReturnSchema } from "./sales-return.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerSalesReturnsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: salesReturnSchema });

  typed.get("/sales-returns", {
    preHandler: requirePermission(PERMISSIONS["sales-returns:read"]),
    schema: {
      description: "List sales returns",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        customerId: z.string().optional(),
        invoiceId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(z.any()), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const filters: Record<string, string[]> = {};
    if (query.customerId) filters.customerId = [String(query.customerId)];
    if (query.invoiceId) filters.invoiceId = [String(query.invoiceId)];
    const result = await salesReturnService.list({ ...options, filters });
    return paginated(await Promise.all(result.items.map((r) => salesReturnService.enrich(r))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/sales-returns/:id", {
    preHandler: requirePermission(PERMISSIONS["sales-returns:read"]),
    schema: {
      description: "Get a sales return by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await salesReturnService.enrich(await salesReturnService.getById(id)));
  });

  typed.post("/sales-returns", {
    preHandler: requirePermission(PERMISSIONS["sales-returns:create"]),
    schema: {
      description: "Create a sales return (reverses stock, adjusts invoice)",
      security: [{ bearerAuth: [] }],
      body: salesReturnCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const record = await salesReturnService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await salesReturnService.enrich(record));
  });

  typed.patch("/sales-returns/:id", {
    preHandler: requirePermission(PERMISSIONS["sales-returns:update"]),
    schema: {
      description: "Update a sales return",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: salesReturnUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const record = await salesReturnService.update(id, request.body, getAuditContext(request));
    return ok(await salesReturnService.enrich(record));
  });

  typed.post("/sales-returns/:id/void", {
    preHandler: requirePermission(PERMISSIONS["sales-returns:update"]),
    schema: {
      description: "Void a sales return (reverses stock and invoice adjustments)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await salesReturnService.enrich(await salesReturnService.void(id, getAuditContext(request))));
  });

  typed.delete("/sales-returns/:id", {
    preHandler: requirePermission(PERMISSIONS["sales-returns:delete"]),
    schema: {
      description: "Delete a sales return",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await salesReturnService.delete(id, getAuditContext(request)));
  });
}
