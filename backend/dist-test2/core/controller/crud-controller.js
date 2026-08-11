import { z } from "zod";
import { parseListOptions } from "../pagination/list-options.js";
import { ok, paginated, computeMeta } from "../response/response.js";
import { requirePermission } from "../security/rbac.js";
import { getAuditContext } from "../http/context.js";
/**
 * Registers the standard REST endpoints for a CRUD resource:
 *   GET    /               → list (paginated, filterable, searchable, sortable)
 *   GET    /:id            → read one
 *   POST   /               → create
 *   PUT    /:id            → full update
 *   PATCH  /:id            → partial update
 *   DELETE /:id            → delete
 *
 * Route-level RBAC is enforced via `requirePermission` pre-handlers.
 */
export function registerCrudController(opts) {
    const { app, path, service, permissions, schemas } = opts;
    const typed = app.withTypeProvider();
    const paginatedResponse = z.object({
        success: z.literal(true),
        data: z.array(schemas.entity),
        meta: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
            hasNextPage: z.boolean(),
            hasPreviousPage: z.boolean(),
        }),
    });
    const singleResponse = z.object({ success: z.literal(true), data: schemas.entity });
    const deleteResponse = z.object({ success: z.literal(true), data: z.object({ id: z.string() }) });
    const serialize = opts.serialize ?? ((entity) => entity);
    const serializeAll = async (items) => Promise.all(items.map(async (item) => await serialize(item)));
    typed.get(path, {
        preHandler: requirePermission(permissions.read),
        schema: {
            description: `List ${path.slice(1)}`,
            security: [{ bearerAuth: [] }],
            querystring: z.object({
                page: z.coerce.number().int().min(1).optional(),
                limit: z.coerce.number().int().min(1).max(100).optional(),
                sortBy: z.string().optional(),
                sortDir: z.enum(["asc", "desc"]).optional(),
                search: z.string().optional(),
            }),
            response: { 200: paginatedResponse },
        },
    }, async (request) => {
        const options = parseListOptions(request.query);
        const result = await service.list({ ...options, searchFields: opts.searchFields });
        return paginated(await serializeAll(result.items), computeMeta(result.page, result.limit, result.total));
    });
    typed.get(`${path}/:id`, {
        preHandler: requirePermission(permissions.read),
        schema: {
            description: `Get ${path.slice(1)} by id`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            response: { 200: singleResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        const entity = await service.getById(id);
        return ok(await serialize(entity));
    });
    typed.post(path, {
        preHandler: requirePermission(permissions.create),
        schema: {
            description: `Create ${path.slice(1)}`,
            security: [{ bearerAuth: [] }],
            body: schemas.create,
            response: { 201: singleResponse },
        },
    }, async (request, reply) => {
        const entity = await service.create(request.body, getAuditContext(request));
        void reply.status(201);
        return ok(await serialize(entity));
    });
    typed.put(`${path}/:id`, {
        preHandler: requirePermission(permissions.update),
        schema: {
            description: `Replace ${path.slice(1)}`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            body: schemas.update,
            response: { 200: singleResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        const entity = await service.update(id, request.body, getAuditContext(request));
        return ok(await serialize(entity));
    });
    typed.patch(`${path}/:id`, {
        preHandler: requirePermission(permissions.update),
        schema: {
            description: `Partially update ${path.slice(1)}`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            body: schemas.update.partial(),
            response: { 200: singleResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        const entity = await service.update(id, request.body, getAuditContext(request));
        return ok(await serialize(entity));
    });
    typed.delete(`${path}/:id`, {
        preHandler: requirePermission(permissions.delete),
        schema: {
            description: `Delete ${path.slice(1)}`,
            security: [{ bearerAuth: [] }],
            params: z.object({ id: z.string() }),
            response: { 200: deleteResponse },
        },
    }, async (request) => {
        const { id } = request.params;
        const result = await service.delete(id, getAuditContext(request));
        return ok(result);
    });
}
