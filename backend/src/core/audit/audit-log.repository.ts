import { PrismaRepository, type ListOptions, type ListResult } from "../repository/base-repository.js";
import type { AuditLogEntry } from "./audit-log.entity.js";

type Row = Record<string, unknown>;

export class AuditLogRepository extends PrismaRepository<AuditLogEntry> {
  protected model = "auditLog";
  protected softDelete = false;
  protected searchFields = ["actorEmail", "action", "resource", "resourceId"];

  protected toEntity(row: Row): AuditLogEntry {
    return {
      id: String(row.id),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      actorId: row.actorId ? String(row.actorId) : "system",
      actorEmail: String(row.actorEmail),
      action: String(row.action),
      resource: String(row.resource),
      resourceId: row.resourceId ? String(row.resourceId) : undefined,
      ip: row.ip ? String(row.ip) : undefined,
      details: this.parseDetails(row.details),
    };
  }

  private parseDetails(raw: unknown): unknown {
    if (!raw) return undefined;
    try {
      return JSON.parse(String(raw)) as unknown;
    } catch {
      return String(raw);
    }
  }

  protected toCreateData(data: Omit<AuditLogEntry, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    return {
      ...data,
      actorId: data.actorId === "system" ? null : data.actorId,
      details: data.details !== undefined ? JSON.stringify(data.details) : undefined,
    };
  }

  async list(options: ListOptions = {}): Promise<ListResult<AuditLogEntry>> {
    return super.list({
      ...options,
      sortBy: options.sortBy ?? "createdAt",
      sortDir: options.sortDir ?? "desc",
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
