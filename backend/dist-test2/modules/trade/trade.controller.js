import { createInvoiceService } from "./invoice.service.js";
import { invoiceCreateSchema, invoiceUpdateSchema, invoiceSchema, paymentSchema, } from "./invoice.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";
import { z } from "zod";
function registerInvoiceRoutes(app, path, type, permissions) {
    const typed = app.withTypeProvider();
    const service = createInvoiceService(type);
    const singleResponse = z.object({ success: z.literal(true), data: invoiceSchema });
    const simpleResponse = z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) });
    typed.get(path, {
        preHandler: requirePermission(permissions.read),
        schema: {
            description: `List ${type} invoices`,
            security: [{ bearerAuth: [] }],
            querystring: z.object({
                page: z.coerce.number().int().min(1).optional(),
                limit: z.coerce.number().int().min(1).max(100).optional(),
                sortBy: z.string().optional(),
                sortDir: z.enum(["asc", "desc"]).optional(),
                search: z.string().optional(),
                status: z.string().optional(),
            }),
            response: { 200: z.object({ success: z.literal(true), data: z.array(invoiceSchema), meta: z.any() }) },
        },
    }, async (request) => {
        const query = request.query;
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
            description: `Get ${type} invoice by id`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            response: { 200: singleResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        return ok(await service.enrich(await service.getById(id)));
    });
    typed.post(path, {
        preHandler: requirePermission(permissions.create),
        schema: {
            description: `Create ${type} invoice`,
            security: [{ bearerAuth: [] }],
            body: invoiceCreateSchema,
            response: { 201: singleResponse },
        },
    }, async (request, reply) => {
        const invoice = await service.create(request.body, getAuditContext(request));
        void reply.status(201);
        return ok(await service.enrich(invoice));
    });
    typed.patch(`${path}/:id`, {
        preHandler: requirePermission(permissions.update),
        schema: {
            description: `Update ${type} invoice`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            body: invoiceUpdateSchema,
            response: { 200: singleResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        const invoice = await service.update(id, request.body, getAuditContext(request));
        return ok(await service.enrich(invoice));
    });
    typed.post(`${path}/:id/pay`, {
        preHandler: requirePermission(permissions.update),
        schema: {
            description: `Register a payment against ${type} invoice`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            body: paymentSchema,
            response: { 200: singleResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        const invoice = await service.registerPayment(id, request.body.amount, request.body.method, getAuditContext(request));
        return ok(await service.enrich(invoice));
    });
    typed.post(`${path}/:id/void`, {
        preHandler: requirePermission(permissions.void),
        schema: {
            description: `Void ${type} invoice`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            response: { 200: singleResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        const invoice = await service.void(id, getAuditContext(request));
        return ok(await service.enrich(invoice));
    });
}
export function registerSalesController(app) {
    registerInvoiceRoutes(app, "/sales", "sales", {
        read: PERMISSIONS["sales:read"],
        create: PERMISSIONS["sales:create"],
        update: PERMISSIONS["sales:update"],
        void: PERMISSIONS["sales:void"],
    });
}
export function registerPurchasesController(app) {
    registerInvoiceRoutes(app, "/purchases", "purchase", {
        read: PERMISSIONS["purchases:read"],
        create: PERMISSIONS["purchases:create"],
        update: PERMISSIONS["purchases:update"],
        void: PERMISSIONS["purchases:void"],
    });
}
