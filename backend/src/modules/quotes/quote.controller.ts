import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createQuoteService } from "./quote.service.js";
import { quoteCreateSchema, quoteUpdateSchema, quoteSchema } from "./quote.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

function registerQuoteRoutes(
  app: FastifyInstance,
  path: string,
  type: "sales" | "purchase",
  permissions: { read: string; create: string; update: string; delete: string },
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const service = createQuoteService(type);
  const singleResponse = z.object({ success: z.literal(true), data: quoteSchema });

  typed.get(path, {
    preHandler: requirePermission(permissions.read),
    schema: {
      description: `List ${type} quotes`,
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        status: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(quoteSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await service.list({
      ...options,
      filters: query.status ? { status: [String(query.status)] } : undefined,
    });
    return paginated(await Promise.all(result.items.map((i) => service.enrich(i))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get(`${path}/:id`, {
    preHandler: requirePermission(permissions.read),
    schema: {
      description: `Get ${type} quote by id`,
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
      description: `Create ${type} quote`,
      security: [{ bearerAuth: [] }],
      body: quoteCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const quote = await service.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await service.enrich(quote));
  });

  typed.patch(`${path}/:id`, {
    preHandler: requirePermission(permissions.update),
    schema: {
      description: `Update ${type} quote`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: quoteUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const quote = await service.update(id, request.body, getAuditContext(request));
    return ok(await service.enrich(quote));
  });

  typed.post(`${path}/:id/convert`, {
    preHandler: requirePermission(permissions.update),
    schema: {
      description: `Convert ${type} quote into an invoice`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.literal(true), data: z.object({ quote: quoteSchema, invoiceId: z.string() }) }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const result = await service.convert(id, getAuditContext(request));
    return ok({ quote: await service.enrich(result.quote), invoiceId: result.invoiceId });
  });

  typed.delete(`${path}/:id`, {
    preHandler: requirePermission(permissions.delete),
    schema: {
      description: `Delete ${type} quote`,
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

export function registerSalesQuotesController(app: FastifyInstance): void {
  registerQuoteRoutes(app, "/quotes/sales", "sales", {
    read: PERMISSIONS["quotes:read"],
    create: PERMISSIONS["quotes:create"],
    update: PERMISSIONS["quotes:update"],
    delete: PERMISSIONS["quotes:delete"],
  });
}

export function registerPurchaseQuotesController(app: FastifyInstance): void {
  registerQuoteRoutes(app, "/quotes/purchases", "purchase", {
    read: PERMISSIONS["quotes:read"],
    create: PERMISSIONS["quotes:create"],
    update: PERMISSIONS["quotes:update"],
    delete: PERMISSIONS["quotes:delete"],
  });
}
