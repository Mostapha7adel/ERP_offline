import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { purchaseOrderService } from "./purchase-order.service.js";
import { poCreateSchema, poUpdateSchema, poSchema } from "./purchase-order.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerPurchaseOrdersController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: poSchema });

  typed.get("/purchase-orders", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:read"]),
    schema: {
      description: "List purchase orders",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        status: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(poSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await purchaseOrderService.list({
      ...options,
      filters: query.status ? { status: [String(query.status)] } : undefined,
    });
    return paginated(await Promise.all(result.items.map((i) => purchaseOrderService.enrich(i))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/purchase-orders/:id", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:read"]),
    schema: {
      description: "Get purchase order by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await purchaseOrderService.enrich(await purchaseOrderService.getById(id)));
  });

  typed.post("/purchase-orders", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:create"]),
    schema: {
      description: "Create a purchase order (draft)",
      security: [{ bearerAuth: [] }],
      body: poCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const po = await purchaseOrderService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await purchaseOrderService.enrich(po));
  });

  typed.patch("/purchase-orders/:id", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:update"]),
    schema: {
      description: "Update a purchase order",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: poUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const po = await purchaseOrderService.update(id, request.body, getAuditContext(request));
    return ok(await purchaseOrderService.enrich(po));
  });

  typed.post("/purchase-orders/:id/submit", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:update"]),
    schema: {
      description: "Submit a purchase order for approval",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const po = await purchaseOrderService.submit(id, getAuditContext(request));
    return ok(await purchaseOrderService.enrich(po));
  });

  typed.post("/purchase-orders/:id/approve", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:approve"]),
    schema: {
      description: "Approve a pending purchase order",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const po = await purchaseOrderService.approve(id, getAuditContext(request));
    return ok(await purchaseOrderService.enrich(po));
  });

  typed.post("/purchase-orders/:id/cancel", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:update"]),
    schema: {
      description: "Cancel a purchase order",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const po = await purchaseOrderService.cancel(id, getAuditContext(request));
    return ok(await purchaseOrderService.enrich(po));
  });

  typed.post("/purchase-orders/:id/receive", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:receive"]),
    schema: {
      description: "Receive goods on an approved purchase order (creates a purchase invoice)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: z.object({
        quantities: z.record(z.string(), z.number()).optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { quantities?: Record<string, number> } | undefined;
    const result = await purchaseOrderService.receive(id, body ?? {}, getAuditContext(request));
    return ok({
      ...(await purchaseOrderService.enrich(result.po)),
      invoiceId: result.invoiceId,
    });
  });

  typed.delete("/purchase-orders/:id", {
    preHandler: requirePermission(PERMISSIONS["purchase-orders:delete"]),
    schema: {
      description: "Delete a purchase order",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await purchaseOrderService.delete(id, getAuditContext(request)));
  });
}