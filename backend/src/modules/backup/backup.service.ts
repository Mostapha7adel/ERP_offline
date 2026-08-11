import { AppError } from "../../core/errors/app-error.js";
import { backupRepository } from "./backup.repository.js";
import { createBackupSchema, type CreateBackupInput } from "./backup.entity.js";
import type { Backup } from "./backup.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { logger } from "../../core/logger/logger.js";

export class BackupService {
  /** Tables whose presence is required for a valid restore snapshot. */
  private static readonly REQUIRED_TABLES = [
    "company",
    "user",
    "role",
    "permission",
    "party",
  ] as const;

  async createBackup(input: CreateBackupInput, audit: AuditContext): Promise<Backup> {
    const validated = createBackupSchema.parse(input ?? {});
    const data = await this.exportAll();
    const serialized = JSON.stringify(data);
    const recordCount = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);

    const backup = await backupRepository.create({
      data: {
        label: validated.label ?? `Backup ${new Date().toLocaleString()}`,
        sizeBytes: Buffer.byteLength(serialized, "utf8"),
        recordCount,
        createdBy: audit.principal?.sub ?? "system",
        data,
      },
    });

    await auditService.log(audit, "create:backup", "backup", backup.id);
    return backup;
  }

  async listBackups(options: { page?: number; limit?: number } = {}) {
    return backupRepository.list({
      page: options.page,
      limit: options.limit,
      sortBy: "createdAt",
      sortDir: "desc",
    });
  }

  async getBackup(id: string): Promise<Backup> {
    const backup = await backupRepository.findById(id);
    if (!backup) throw AppError.notFound("backup not found");
    return backup;
  }

  async getDownload(id: string): Promise<{ filename: string; json: string }> {
    const backup = await this.getBackup(id);
    return {
      filename: `ledgerflow-backup-${backup.createdAt.slice(0, 10)}.json`,
      json: JSON.stringify(
        { app: "ledgerflow", version: 1, createdAt: backup.createdAt, data: backup.data },
        null,
        2,
      ),
    };
  }

  async deleteBackup(id: string, audit: AuditContext): Promise<{ id: string }> {
    if (!(await backupRepository.findById(id))) throw AppError.notFound("backup not found");
    await backupRepository.delete(id);
    await auditService.log(audit, "delete:backup", "backup", id);
    return { id };
  }

  /** Full restore: replaces the entire dataset with a backup's snapshot. */
  async restoreFromBackup(backupId: string, audit: AuditContext): Promise<{ restored: number }> {
    const backup = await backupRepository.findById(backupId);
    if (!backup) throw AppError.notFound("backup not found");

    await this.importAll(backup.data);
    const restored = Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0);
    await auditService.log(audit, "restore:from-backup", "restore", backupId, { restored });
    logger.info({ backupId, restored }, "Database restored from backup");
    return { restored };
  }

  /**
   * Raw restore from an uploaded JSON payload. Accepts either the flat
   * `{ tableName: [...] }` snapshot or the wrapped download format
   * `{ app: "ledgerflow", version: N, data: {...} }`. Validates the shape and
   * required tables before wiping the database.
   */
  async restoreFromPayload(payload: unknown, audit: AuditContext): Promise<{ restored: number }> {
    const data = this.normalizeRestorePayload(payload);
    await this.importAll(data);
    const restored = Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    await auditService.log(audit, "restore:from-payload", "restore", undefined, { restored });
    logger.info({ restored }, "Database restored from payload");
    return { restored };
  }

  /** Normalize + validate an uploaded payload into a flat table-name → rows map. */
  private normalizeRestorePayload(payload: unknown): Record<string, unknown[]> {
    if (payload === null || typeof payload !== "object") {
      throw AppError.badRequest("Invalid restore payload: expected an object");
    }

    // Wrapped download format: { app, version, createdAt, data }.
    const asRecord = payload as Record<string, unknown>;
    if ("app" in asRecord || "version" in asRecord || "data" in asRecord) {
      const app = asRecord["app"];
      if (app !== "ledgerflow") {
        throw AppError.badRequest('Invalid restore payload: unrecognized app signature');
      }
      const version = asRecord["version"];
      if (typeof version !== "number" || version > 1) {
        throw AppError.badRequest("Invalid restore payload: unsupported backup version");
      }
      const nested = asRecord["data"];
      if (nested === null || typeof nested !== "object" || Array.isArray(nested)) {
        throw AppError.badRequest("Invalid restore payload: missing data snapshot");
      }
      return this.validateSnapshot(nested as Record<string, unknown>);
    }

    return this.validateSnapshot(asRecord);
  }

  /** Ensure every required table key exists with an array value. */
  private validateSnapshot(snapshot: Record<string, unknown>): Record<string, unknown[]> {
    if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw AppError.badRequest("Invalid restore payload: expected a table snapshot object");
    }
    for (const table of BackupService.REQUIRED_TABLES) {
      const value = snapshot[table];
      if (!Array.isArray(value)) {
        throw AppError.badRequest(
          `Invalid restore payload: missing required table "${table}"`,
        );
      }
    }
    for (const [key, value] of Object.entries(snapshot)) {
      if (!Array.isArray(value)) {
        throw AppError.badRequest(`Invalid restore payload: "${key}" must be an array`);
      }
    }
    return snapshot as Record<string, unknown[]>;
  }

  /** Serialize the full database snapshot from Prisma. */
  private async exportAll(): Promise<Record<string, unknown[]>> {
    const { prisma } = await import("../../core/database/prisma.js");
    const { resetCompanyCache } = await import("../../core/database/company.js");
    resetCompanyCache();
    const tables = [
      "company", "permission", "role", "rolePermission", "user", "authSession",
      "party", "category", "unit", "product", "warehouse", "stockItem", "stockMovement",
      "invoice", "invoiceLine", "invoicePayment", "treasuryAccount", "treasuryTransaction",
      "account", "costCenter", "journalEntry", "journalDetail", "asset", "report", "setting",
      "backup", "notification",
    ] as const;
    const db = prisma as unknown as Record<string, { findMany(): Promise<unknown[]> }>;
    const out: Record<string, unknown[]> = {};
    for (const table of tables) {
      const rows = await db[table].findMany();
      out[table] = rows as unknown[];
    }
    return out;
  }

  /**
   * Wipe every table and re-create the empty workspace scaffolding
   * (company, roles, admin user, default settings). Used when the client
   * chooses "start from scratch" during first-run setup.
   */
  async resetToEmptyWorkspace(audit: AuditContext): Promise<{ success: boolean }> {
    await this.wipeAll();
    const { seedDatabase } = await import("../../seed/seed.js");
    await seedDatabase();
    await auditService.log(audit, "reset:workspace", "restore", undefined, {});
    logger.info("Database reset to empty workspace");
    return { success: true };
  }

  /** Delete all rows from every table in dependency-safe order. */
  private async wipeAll(): Promise<void> {
    const { runInTransaction } = await import("../../core/database/prisma.js");
    const { getDb } = await import("../../core/database/prisma.js");
    const { resetCompanyCache } = await import("../../core/database/company.js");
    await runInTransaction(async () => {
      const tables = [
        "journalDetail", "journalEntry", "asset", "costCenter", "account", "invoicePayment",
        "invoiceLine", "invoice", "treasuryTransaction", "treasuryAccount", "stockMovement",
        "stockItem", "warehouse", "product", "unit", "category", "party", "authSession",
        "user", "rolePermission", "role", "permission", "company", "report", "setting",
        "backup", "notification", "networkDevice", "networkWorkspace",
      ] as const;
      const db = getDb() as unknown as Record<string, { deleteMany(): Promise<unknown> }>;
      for (const table of tables) {
        await db[table].deleteMany();
      }
      resetCompanyCache();
    });
  }

  /** Wipe and re-import a snapshot into Prisma (inside one transaction). */
  private async importAll(data: Record<string, unknown[]>): Promise<void> {
    const { runInTransaction } = await import("../../core/database/prisma.js");
    const { getDb } = await import("../../core/database/prisma.js");
    const { resetCompanyCache } = await import("../../core/database/company.js");
    if (!data || typeof data !== "object") throw AppError.badRequest("Invalid restore payload");

    await runInTransaction(async () => {
      const deleteTables = [
        "journalDetail", "journalEntry", "asset", "costCenter", "account", "invoicePayment",
        "invoiceLine", "invoice", "treasuryTransaction", "treasuryAccount", "stockMovement",
        "stockItem", "warehouse", "product", "unit", "category", "party", "authSession",
        "user", "rolePermission", "role", "permission", "company", "report", "setting",
        "backup", "notification", "networkDevice", "networkWorkspace",
      ] as const;
      const createTables = [
        "company", "permission", "role", "rolePermission", "user", "authSession",
        "party", "category", "unit", "product", "warehouse", "stockItem", "stockMovement",
        "account", "costCenter", "asset", "journalEntry", "journalDetail",
        "treasuryAccount", "treasuryTransaction", "invoice", "invoiceLine", "invoicePayment",
        "report", "setting", "backup", "notification",
      ] as const;
      const db = getDb() as unknown as Record<string, { deleteMany(): Promise<unknown>; createMany(args: { data: unknown[] }): Promise<unknown> }>;
      for (const table of deleteTables) {
        await db[table].deleteMany();
      }
      for (const table of createTables) {
        const rows = data[table] ?? [];
        if (rows.length === 0) continue;
        await db[table].createMany({ data: rows as unknown[] });
      }
      resetCompanyCache();
    });
  }
}

export const backupService = new BackupService();
