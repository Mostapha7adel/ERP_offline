import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { paymentVoucherService } from "./payment-voucher.service.js";
import { paymentVoucherCreateSchema, paymentVoucherUpdateSchema, paymentVoucherSchema } from "./payment-voucher.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerPaymentVouchersController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: paymentVoucherSchema });

  typed.get("/payment-vouchers", {
    preHandler: requirePermission(PERMISSIONS["payment-vouchers:read"]),
    schema: {
      description: "List payment vouchers",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        type: z.enum(["receipt", "payment"]).optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(paymentVoucherSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await paymentVoucherService.list({
      ...options,
      type: query.type ? String(query.type) : undefined,
    });
    return paginated(await Promise.all(result.items.map((v) => paymentVoucherService.enrich(v))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/payment-vouchers/:id", {
    preHandler: requirePermission(PERMISSIONS["payment-vouchers:read"]),
    schema: {
      description: "Get a payment voucher by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await paymentVoucherService.enrich(await paymentVoucherService.getById(id)));
  });

  typed.post("/payment-vouchers", {
    preHandler: requirePermission(PERMISSIONS["payment-vouchers:create"]),
    schema: {
      description: "Create a payment voucher",
      security: [{ bearerAuth: [] }],
      body: paymentVoucherCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const voucher = await paymentVoucherService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await paymentVoucherService.enrich(voucher));
  });

  typed.patch("/payment-vouchers/:id", {
    preHandler: requirePermission(PERMISSIONS["payment-vouchers:update"]),
    schema: {
      description: "Update a payment voucher",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: paymentVoucherUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const voucher = await paymentVoucherService.update(id, request.body, getAuditContext(request));
    return ok(await paymentVoucherService.enrich(voucher));
  });

  typed.delete("/payment-vouchers/:id", {
    preHandler: requirePermission(PERMISSIONS["payment-vouchers:delete"]),
    schema: {
      description: "Delete a payment voucher (reverses invoice and treasury adjustments)",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await paymentVoucherService.delete(id, getAuditContext(request)));
  });
}
