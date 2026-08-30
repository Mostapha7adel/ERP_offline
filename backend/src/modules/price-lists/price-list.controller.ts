import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { priceListService } from "./price-list.service.js";
import {
  priceListSchema,
  priceListItemSchema,
  priceListCreateSchema,
  priceListUpdateSchema,
  priceListItemCreateSchema,
} from "./price-list.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { registerCrudController } from "../../core/controller/crud-controller.js";

export function registerPriceListsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  registerCrudController({
    app,
    path: "/price-lists",
    service: priceListService,
    searchFields: ["name", "description"],
    permissions: {
      read: PERMISSIONS["price-lists:read"],
      create: PERMISSIONS["price-lists:create"],
      update: PERMISSIONS["price-lists:update"],
      delete: PERMISSIONS["price-lists:delete"],
    },
    schemas: {
      entity: priceListSchema,
      create: priceListCreateSchema,
      update: priceListUpdateSchema,
      id: z.object({ id: z.string() }),
    },
  });

  typed.get("/price-lists/:id/items", {
    preHandler: requirePermission(PERMISSIONS["price-lists:read"]),
    schema: {
      description: "List items in a price list",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      querystring: z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(priceListItemSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const q = request.query as Record<string, unknown>;
    const result = await priceListService.listItems(id, {
      page: Number(q.page ?? 1),
      limit: Number(q.limit ?? 20),
    });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/price-lists/:id/items/:itemId", {
    preHandler: requirePermission(PERMISSIONS["price-lists:read"]),
    schema: {
      description: "Get a price list item by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string(), itemId: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: priceListItemSchema }) },
    },
  }, async (request) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    return ok(await priceListService.getItemById(id, itemId));
  });

  typed.post("/price-lists/:id/items", {
    preHandler: requirePermission(PERMISSIONS["price-lists:update"]),
    schema: {
      description: "Add an item to a price list",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: priceListItemCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: priceListItemSchema }) },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await priceListService.addItem(id, request.body, getAuditContext(request));
    void reply.status(201);
    return ok(item);
  });

  typed.delete("/price-lists/:id/items/:itemId", {
    preHandler: requirePermission(PERMISSIONS["price-lists:update"]),
    schema: {
      description: "Remove an item from a price list",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string(), itemId: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    return ok(await priceListService.removeItem(id, itemId, getAuditContext(request)));
  });
}
