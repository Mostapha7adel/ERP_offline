import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { serialNumberService } from "./serial-number.service.js";
import { serialNumberCreateSchema, serialNumberBulkCreateSchema, serialNumberAssignSchema, serialNumberReturnSchema, serialNumberSchema } from "./serial-number.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerSerialNumbersController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: serialNumberSchema });

  typed.get("/serial-numbers", {
    preHandler: requirePermission(PERMISSIONS["serial-numbers:read"]),
    schema: {
      description: "List serial numbers with optional filters",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        productId: z.string().optional(),
        status: z.string().optional(),
        warehouseId: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(serialNumberSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const filters: Record<string, string[]> = {};
    if (query.productId) filters.productId = [String(query.productId)];
    if (query.status) filters.status = [String(query.status)];
    if (query.warehouseId) filters.warehouseId = [String(query.warehouseId)];
    const result = await serialNumberService.list({ ...options, filters });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/serial-numbers/:id", {
    preHandler: requirePermission(PERMISSIONS["serial-numbers:read"]),
    schema: {
      description: "Get serial number by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await serialNumberService.getById(id));
  });

  typed.post("/serial-numbers", {
    preHandler: requirePermission(PERMISSIONS["serial-numbers:create"]),
    schema: {
      description: "Create a serial number",
      security: [{ bearerAuth: [] }],
      body: serialNumberCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const serial = await serialNumberService.create(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(serial);
  });

  typed.post("/serial-numbers/bulk-create", {
    preHandler: requirePermission(PERMISSIONS["serial-numbers:create"]),
    schema: {
      description: "Bulk create serial numbers for a product",
      security: [{ bearerAuth: [] }],
      body: serialNumberBulkCreateSchema,
      response: { 201: z.object({ success: z.literal(true), data: z.array(serialNumberSchema) }) },
    },
  }, async (request, reply) => {
    const serials = await serialNumberService.bulkCreate(request.body as any, getAuditContext(request));
    void reply.status(201);
    return ok(serials);
  });

  typed.post("/serial-numbers/assign", {
    preHandler: requirePermission(PERMISSIONS["serial-numbers:update"]),
    schema: {
      description: "Assign a serial number to an invoice",
      security: [{ bearerAuth: [] }],
      body: serialNumberAssignSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { serialNumberId, invoiceId } = request.body as { serialNumberId: string; invoiceId: string };
    return ok(await serialNumberService.assignToInvoice(serialNumberId, invoiceId, getAuditContext(request)));
  });

  typed.post("/serial-numbers/return", {
    preHandler: requirePermission(PERMISSIONS["serial-numbers:update"]),
    schema: {
      description: "Return a serial number to stock",
      security: [{ bearerAuth: [] }],
      body: serialNumberReturnSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { serialNumberId } = request.body as { serialNumberId: string };
    return ok(await serialNumberService.returnSerial(serialNumberId, getAuditContext(request)));
  });
}
