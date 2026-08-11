import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { backupService } from "./backup.service.js";
import { backupSchema, createBackupSchema, restoreRequestSchema, restorePayloadSchema } from "./backup.entity.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { ok, paginated, computeMeta } from "../../core/response/response.js";
import { getAuditContext } from "../../core/http/context.js";
import { requirePermission } from "../../core/security/rbac.js";

export function registerBackupController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post("/backup", {
    preHandler: requirePermission(PERMISSIONS["backup:create"]),
    schema: {
      description: "Create a full database backup",
      security: [{ bearerAuth: [] }],
      body: createBackupSchema,
      response: { 201: z.object({ success: z.literal(true), data: backupSchema }) },
    },
  }, async (request, reply) => {
    const backup = await backupService.createBackup(request.body ?? {}, getAuditContext(request));
    void reply.status(201);
    return ok(backup);
  });

  typed.get("/backup", {
    preHandler: requirePermission(PERMISSIONS["backup:read"]),
    schema: {
      description: "List backups",
      security: [{ bearerAuth: [] }],
      querystring: z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional() }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(backupSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const q = request.query as Record<string, unknown>;
    const page = Number(q.page ?? 1);
    const limit = Number(q.limit ?? 20);
    const result = await backupService.listBackups({ page, limit });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });

  typed.get("/backup/:id", {
    preHandler: requirePermission(PERMISSIONS["backup:read"]),
    schema: {
      description: "Get backup metadata",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: backupSchema }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await backupService.getBackup(id));
  });

  typed.get("/backup/:id/download", {
    preHandler: requirePermission(PERMISSIONS["backup:read"]),
    schema: {
      description: "Download a backup as JSON",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.any() },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { filename, json } = await backupService.getDownload(id);
    void reply.header("Content-Type", "application/json");
    void reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    return JSON.parse(json);
  });

  typed.delete("/backup/:id", {
    preHandler: requirePermission(PERMISSIONS["backup:delete"]),
    schema: {
      description: "Delete a backup",
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.string() }) }) },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ok(await backupService.deleteBackup(id, getAuditContext(request)));
  });

  // ---- Restore ----

  typed.post("/restore/from-backup", {
    preHandler: requirePermission(PERMISSIONS["restore:create"]),
    schema: {
      description: "Restore the database from an existing backup",
      security: [{ bearerAuth: [] }],
      body: restoreRequestSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.object({ restored: z.number() }) }) },
    },
  }, async (request) => {
    return ok(await backupService.restoreFromBackup(request.body.backupId, getAuditContext(request)));
  });

  typed.post("/restore/from-payload", {
    preHandler: requirePermission(PERMISSIONS["restore:create"]),
    schema: {
      description: "Restore the database from an uploaded JSON payload",
      security: [{ bearerAuth: [] }],
      body: restorePayloadSchema,
      response: { 200: z.object({ success: z.literal(true), data: z.object({ restored: z.number() }) }) },
    },
  }, async (request) => {
    const body = request.body as Record<string, unknown>;
    // Accept both the raw wrapped snapshot ({ app, version, data }) and the
    // legacy client envelope ({ data }).
    const payload = body && "data" in body && !("app" in body) ? body.data : body;
    return ok(await backupService.restoreFromPayload(payload, getAuditContext(request)));
  });

  typed.post("/reset/workspace", {
    preHandler: requirePermission(PERMISSIONS["restore:create"]),
    schema: {
      description: "Wipe all data and re-create the empty workspace scaffolding",
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ success: z.literal(true), data: z.object({ success: z.boolean() }) }) },
    },
  }, async (request) => {
    return ok(await backupService.resetToEmptyWorkspace(getAuditContext(request)));
  });
}
