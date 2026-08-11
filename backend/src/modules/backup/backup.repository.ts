import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Backup } from "./backup.entity.js";

type Row = Record<string, unknown>;

export class BackupRepository extends PrismaRepository<Backup> {
  protected model = "backup";
  protected searchFields = ["label"];

  protected toEntity(row: Row): Backup {
    return {
      id: String(row.id),
      label: String(row.label),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      createdBy: String(row.createdBy),
      sizeBytes: Number(row.sizeBytes),
      recordCount: Number(row.recordCount),
      data: this.parseData(row.data),
    };
  }

  private parseData(raw: unknown): Record<string, unknown[]> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(String(raw)) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown[]>;
      }
    } catch {
      // fall through to empty snapshot
    }
    return {};
  }

  protected toCreateData(data: Omit<Backup, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    return { ...data, data: JSON.stringify(data.data ?? {}) };
  }
}

export const backupRepository = new BackupRepository();
