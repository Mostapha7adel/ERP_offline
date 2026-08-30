import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { landedCostService } from "./landed-cost.service.js";
import { landedCostCreateSchema, landedCostUpdateSchema, landedCostSchema } from "./landed-cost.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerLandedCostsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: landedCostSchema });

  typed.get("/landed-costs", {
    preHandler: requirePermission(PERMISSIONS["landed-costs:read"]),
    schema: {
      description: "List landed costs",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(landedCostSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await landedCostService.list(options);
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/landed-costs/:id", {
    preHandler: requirePermission(PERMISSIONS["landed-costs:read"]),
    schema: {
      description: "Get landed cost by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await landedCostService.getById(id));
  });

  typed.post("/landed-costs", {
    preHandler: requirePermission(PERMISSIONS["landed-costs:create"]),
    schema: {
      description: "Create a landed cost and allocate to purchase invoice lines",
      security: [{ bearerAuth: [] }],
      body: landedCostCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const landedCost = await landedCostService.create(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(landedCost);
  });

  typed.patch("/landed-costs/:id", {
    preHandler: requirePermission(PERMISSIONS["landed-costs:update"]),
    schema: {
      description: "Update a landed cost",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: landedCostUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await landedCostService.update(id, request.body as any, getAuditContext(request)));
  });

  typed.delete("/landed-costs/:id", {
    preHandler: requirePermission(PERMISSIONS["landed-costs:delete"]),
    schema: {
      description: "Delete a landed cost",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await landedCostService.delete(id, getAuditContext(request)));
  });
}
