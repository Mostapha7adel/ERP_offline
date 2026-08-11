import { PrismaRepository } from "../repository/base-repository.js";
export class AuditLogRepository extends PrismaRepository {
    model = "auditLog";
    softDelete = false;
    searchFields = ["actorEmail", "action", "resource", "resourceId"];
    toEntity(row) {
        return {
            id: String(row.id),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
            actorId: row.actorId ? String(row.actorId) : "system",
            actorEmail: String(row.actorEmail),
            action: String(row.action),
            resource: String(row.resource),
            resourceId: row.resourceId ? String(row.resourceId) : undefined,
            ip: row.ip ? String(row.ip) : undefined,
            details: this.parseDetails(row.details),
        };
    }
    parseDetails(raw) {
        if (!raw)
            return undefined;
        try {
            return JSON.parse(String(raw));
        }
        catch {
            return String(raw);
        }
    }
    toCreateData(data) {
        return {
            ...data,
            actorId: data.actorId === "system" ? null : data.actorId,
            details: data.details !== undefined ? JSON.stringify(data.details) : undefined,
        };
    }
    async list(options = {}) {
        return super.list({
            ...options,
            sortBy: options.sortBy ?? "createdAt",
            sortDir: options.sortDir ?? "desc",
        });
    }
}
export const auditLogRepository = new AuditLogRepository();
