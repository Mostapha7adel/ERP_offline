import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { advanceService } from "./advance.service.js";
import { advanceCreateSchema, advanceUpdateSchema, advanceAllocateSchema, advanceSchema } from "./advance.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerAdvancesController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: advanceSchema });

  typed.get("/advances", {
    preHandler: requirePermission(PERMISSIONS["advances:read"]),
    schema: {
      description: "List customer advances",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        partyId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(advanceSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await advanceService.list({
      ...options,
      partyId: query.partyId ? String(query.partyId) : undefined,
    });
    return paginated(await Promise.all(result.items.map((i) => advanceService.enrich(i))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/advances/:id", {
    preHandler: requirePermission(PERMISSIONS["advances:read"]),
    schema: {
      description: "Get customer advance by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await advanceService.enrich(await advanceService.getById(id)));
  });

  typed.post("/advances", {
    preHandler: requirePermission(PERMISSIONS["advances:create"]),
    schema: {
      description: "Record a customer advance",
      security: [{ bearerAuth: [] }],
      body: advanceCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const advance = await advanceService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await advanceService.enrich(advance));
  });

  typed.patch("/advances/:id", {
    preHandler: requirePermission(PERMISSIONS["advances:update"]),
    schema: {
      description: "Update a customer advance",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: advanceUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const advance = await advanceService.update(id, request.body, getAuditContext(request));
    return ok(await advanceService.enrich(advance));
  });

  typed.post("/advances/:id/allocate", {
    preHandler: requirePermission(PERMISSIONS["advances:allocate"]),
    schema: {
      description: "Allocate an advance against a sales invoice",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: advanceAllocateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const advance = await advanceService.allocate(id, request.body, getAuditContext(request));
    return ok(await advanceService.enrich(advance));
  });

  typed.delete("/advances/:id", {
    preHandler: requirePermission(PERMISSIONS["advances:delete"]),
    schema: {
      description: "Delete a customer advance",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await advanceService.delete(id, getAuditContext(request)));
  });
}