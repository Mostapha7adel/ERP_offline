import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createRecurringService } from "./recurring.service.js";
import { recurringCreateSchema, recurringUpdateSchema, recurringSchema } from "./recurring.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

function registerRecurringRoutes(
  app: FastifyInstance,
  path: string,
  type: "sales" | "purchase",
  permissions: { read: string; create: string; update: string; delete: string },
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const service = createRecurringService(type);
  const singleResponse = z.object({ success: z.literal(true), data: recurringSchema });

  typed.get(path, {
    preHandler: requirePermission(permissions.read),
    schema: {
      description: `List ${type} recurring invoices`,
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(recurringSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await service.list(options);
    return paginated(await Promise.all(result.items.map((i) => service.enrich(i))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get(`${path}/:id`, {
    preHandler: requirePermission(permissions.read),
    schema: {
      description: `Get ${type} recurring invoice by id`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await service.enrich(await service.getById(id)));
  });

  typed.post(path, {
    preHandler: requirePermission(permissions.create),
    schema: {
      description: `Create ${type} recurring invoice template`,
      security: [{ bearerAuth: [] }],
      body: recurringCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const recurring = await service.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await service.enrich(recurring));
  });

  typed.patch(`${path}/:id`, {
    preHandler: requirePermission(permissions.update),
    schema: {
      description: `Update ${type} recurring invoice template`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: recurringUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const recurring = await service.update(id, request.body, getAuditContext(request));
    return ok(await service.enrich(recurring));
  });

  typed.post(`${path}/run`, {
    preHandler: requirePermission(permissions.update),
    schema: {
      description: `Generate due ${type} invoices from recurring templates`,
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          success: z.literal(true),
          data: z.object({ generated: z.number(), invoices: z.array(z.string()) }),
        }),
      },
    },
  }, async (request) => {
    return ok(await service.runDue(getAuditContext(request)));
  });
  typed.delete(`${path}/:id`, {
    preHandler: requirePermission(permissions.delete),
    schema: {
      description: `Delete ${type} recurring invoice template`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const success = await service.delete(id, getAuditContext(request));
    return ok({ success });
  });
}

export function registerSalesRecurringController(app: FastifyInstance): void {
  registerRecurringRoutes(app, "/recurring/sales", "sales", {
    read: PERMISSIONS["recurring:read"],
    create: PERMISSIONS["recurring:create"],
    update: PERMISSIONS["recurring:update"],
    delete: PERMISSIONS["recurring:delete"],
  });
}

export function registerPurchaseRecurringController(app: FastifyInstance): void {
  registerRecurringRoutes(app, "/recurring/purchases", "purchase", {
    read: PERMISSIONS["recurring:read"],
    create: PERMISSIONS["recurring:create"],
    update: PERMISSIONS["recurring:update"],
    delete: PERMISSIONS["recurring:delete"],
  });
}
