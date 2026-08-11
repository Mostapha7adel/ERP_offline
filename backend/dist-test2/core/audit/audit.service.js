import { auditLogRepository } from "./audit-log.repository.js";
import { logger } from "../logger/logger.js";
export class AuditService {
    async log(context, action, resource, resourceId, details) {
        try {
            await auditLogRepository.create({
                data: {
                    actorId: context.principal?.sub ?? "system",
                    actorEmail: context.principal?.email ?? "system",
                    action,
                    resource,
                    resourceId,
                    ip: context.ip,
                    details,
                },
            });
        }
        catch (error) {
            // Audit failures must never break the main request flow.
            logger.error({ error, action, resource }, "Failed to write audit log");
        }
    }
}
export const auditService = new AuditService();
