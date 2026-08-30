import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { warrantyService } from "./warranty.service.js";
import { warrantyCreateSchema, warrantyClaimSchema, warrantySchema } from "./warranty.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerWarrantiesController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: warrantySchema });

  typed.get("/warranties", {
    preHandler: requirePermission(PERMISSIONS["warranties:read"]),
    schema: {
      description: "List warranties with optional filters",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        status: z.string().optional(),
        customerId: z.string().optional(),
        productId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(warrantySchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const filters: Record<string, string[]> = {};
    if (query.status) filters.status = [String(query.status)];
    if (query.customerId) filters.customerId = [String(query.customerId)];
    if (query.productId) filters.productId = [String(query.productId)];
    const result = await warrantyService.list({ ...options, filters });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/warranties/:id", {
    preHandler: requirePermission(PERMISSIONS["warranties:read"]),
    schema: {
      description: "Get warranty by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await warrantyService.getById(id));
  });

  typed.post("/warranties", {
    preHandler: requirePermission(PERMISSIONS["warranties:create"]),
    schema: {
      description: "Create a warranty",
      security: [{ bearerAuth: [] }],
      body: warrantyCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const warranty = await warrantyService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(warranty);
  });

  typed.post("/warranties/claim", {
    preHandler: requirePermission(PERMISSIONS["warranties:update"]),
    schema: {
      description: "Claim a warranty",
      security: [{ bearerAuth: [] }],
      body: warrantyClaimSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { warrantyId, notes } = request.body as { warrantyId: string; notes?: string };
    return ok(await warrantyService.claim(warrantyId, notes, getAuditContext(request)));
  });

  typed.delete("/warranties/:id", {
    preHandler: requirePermission(PERMISSIONS["warranties:delete"]),
    schema: {
      description: "Delete a warranty",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await warrantyService.delete(id, getAuditContext(request)));
  });
}
