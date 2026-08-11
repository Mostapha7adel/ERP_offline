import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { auditLogRepository } from "../../core/audit/audit-log.repository.js";
import { auditLogSchema } from "../../core/audit/audit-log.entity.js";
import { PERMISSIONS } from "../../core/security/permissions.js";
import { paginated, computeMeta } from "../../core/response/response.js";
import { requirePermission } from "../../core/security/rbac.js";
import { parseListOptions } from "../../core/pagination/list-options.js";

export function registerAuditController(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/audit-logs", {
    preHandler: requirePermission(PERMISSIONS["audit:read"]),
    schema: {
      description: "List audit log entries",
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        search: z.string().optional(),
        actorEmail: z.string().optional(),
        resource: z.string().optional(),
        action: z.string().optional(),
      }),
      response: { 200: z.object({ success: z.literal(true), data: z.array(auditLogSchema), meta: z.any() }) },
    },
  }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const options = parseListOptions(query);
    const result = await auditLogRepository.list({
      ...options,
      searchFields: ["actorEmail", "action", "resource"],
      filters: {
        ...(query.actorEmail ? { actorEmail: [String(query.actorEmail)] } : {}),
        ...(query.resource ? { resource: [String(query.resource)] } : {}),
        ...(query.action ? { action: [String(query.action)] } : {}),
      },
    });
    return paginated(result.items, computeMeta(result.page, result.limit, result.total));
  });
}
