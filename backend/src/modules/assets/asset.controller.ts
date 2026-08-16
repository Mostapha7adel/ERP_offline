import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { assetService } from "./asset.service.js";
import { assetCreateSchema, assetUpdateSchema, assetSchema, depreciateSchema } from "./asset.schema.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerAssetsController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const singleResponse = z.object({ success: z.literal(true), data: assetSchema });

  typed.get("/assets", {
    preHandler: requirePermission(PERMISSIONS["assets:read"]),
    schema: {
      description: "List fixed assets",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        search: z.string().optional(),
        status: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(assetSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await assetService.list({
      ...options,
      status: query.status ? String(query.status) : undefined,
    });
    return paginated(await Promise.all(result.items.map((i) => assetService.enrich(i))), computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/assets/:id", {
    preHandler: requirePermission(PERMISSIONS["assets:read"]),
    schema: {
      description: "Get fixed asset by id",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await assetService.enrich(await assetService.getById(id)));
  });

  typed.post("/assets", {
    preHandler: requirePermission(PERMISSIONS["assets:create"]),
    schema: {
      description: "Register a fixed asset",
      security: [{ bearerAuth: [] }],
      body: assetCreateSchema,
      response: { 201: singleResponse },
    },
  }, async (request, reply) => {
    const asset = await assetService.create(request.body, getAuditContext(request));
    void reply.status(201);
    return ok(await assetService.enrich(asset));
  });

  typed.patch("/assets/:id", {
    preHandler: requirePermission(PERMISSIONS["assets:update"]),
    schema: {
      description: "Update a fixed asset",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: assetUpdateSchema,
      response: { 200: singleResponse },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const asset = await assetService.update(id, request.body, getAuditContext(request));
    return ok(await assetService.enrich(asset));
  });

  typed.post("/assets/:id/depreciate", {
    preHandler: requirePermission(PERMISSIONS["assets:depreciate"]),
    schema: {
      description: "Run depreciation for an asset for a period",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      body: depreciateSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.any() }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { period?: string } | undefined;
    const result = await assetService.depreciate(id, body?.period, getAuditContext(request));
    return ok({
      ...(await assetService.enrich(result.asset)),
      run: result.run,
    });
  });

  typed.delete("/assets/:id", {
    preHandler: requirePermission(PERMISSIONS["assets:delete"]),
    schema: {
      description: "Delete a fixed asset",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await assetService.delete(id, getAuditContext(request)));
  });
}