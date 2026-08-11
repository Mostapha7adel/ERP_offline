import type { FastifyInstance } from "fastify";
import type { preHandlerHookHandler } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { BaseEntity } from "../repository/base-repository.js";
import type { CrudService } from "../service/crud-service.js";
import { parseListOptions } from "../pagination/list-options.js";
import { ok, paginated, computeMeta } from "../response/response.js";
import { requirePermission } from "../security/rbac.js";
import { getAuditContext } from "../http/context.js";

export interface CrudControllerOptions<T extends BaseEntity, C, U> {
  app: FastifyInstance;
  /** Route prefix e.g. `/customers` */
  path: string;
  service: CrudService<T, C, U>;
  /** RBAC permission names. */
  permissions: {
    read: string;
    create: string;
    update: string;
    delete: string;
  };
  /** When provided, overrides the permission-based pre-handlers for every route
   *  (e.g. super-admin-only resources like users & roles). */
  preHandler?: preHandlerHookHandler;
  /** Zod schemas for response serialization. */
  schemas: {
    entity: z.ZodType<unknown>;
    create: z.ZodObject<z.ZodRawShape>;
    update: z.ZodObject<z.ZodRawShape>;
    id: z.ZodType<{ id: string }>;
  };
  /** Fields available for free-text search (used by list endpoint). */
  searchFields?: string[];
  /** Optional projection applied to every returned entity (e.g. hide secrets, join relations). */
  serialize?: (entity: T) => unknown | Promise<unknown>;
}

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
export function registerCrudController<T extends BaseEntity, C, U>(
  opts: CrudControllerOptions<T, C, U>,
): void {
  const { app, path, service, permissions, schemas } = opts;
  const typed = app.withTypeProvider<ZodTypeProvider>();

  const routeGuard = (permission: string) =>
    opts.preHandler ?? requirePermission(permission);

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

  const serialize = opts.serialize ?? ((entity: T) => entity);

  const serializeAll = async (items: T[]) => Promise.all(items.map(async (item) => await serialize(item)));

  typed.get(path, {
    preHandler: routeGuard(permissions.read),
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
    const options = parseListOptions(request.query as Record<string, unknown>);
    const result = await service.list({ ...options, searchFields: opts.searchFields });
    return paginated(await serializeAll(result.items), computeMeta(result.page, result.limit, result.total));
  });

  typed.get(`${path}/:id`, {
    preHandler: routeGuard(permissions.read),
    schema: {
      description: `Get ${path.slice(1)} by id`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const entity = await service.getById(id);
    return ok(await serialize(entity));
  });

  typed.post(path, {
    preHandler: routeGuard(permissions.create),
    schema: {
      description: `Create ${path.slice(1)}`,
      security: [{ bearerAuth: [] }],
      body: schemas.create,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const entity = await service.create(request.body as C, getAuditContext(request));
    void reply.status(201);
    return ok(await serialize(entity));
  });

  typed.put(`${path}/:id`, {
    preHandler: routeGuard(permissions.update),
    schema: {
      description: `Replace ${path.slice(1)}`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: schemas.update,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const entity = await service.update(id, request.body as Partial<U>, getAuditContext(request));
    return ok(await serialize(entity));
  });

  typed.patch(`${path}/:id`, {
    preHandler: routeGuard(permissions.update),
    schema: {
      description: `Partially update ${path.slice(1)}`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: schemas.update.partial(),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const entity = await service.update(id, request.body as Partial<U>, getAuditContext(request));
    return ok(await serialize(entity));
  });

  typed.delete(`${path}/:id`, {
    preHandler: routeGuard(permissions.delete),
    schema: {
      description: `Delete ${path.slice(1)}`,
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: deleteResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const result = await service.delete(id, getAuditContext(request));
    return ok(result);
  });
}
