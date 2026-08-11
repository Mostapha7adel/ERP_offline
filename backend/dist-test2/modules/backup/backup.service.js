import { AppError } from "../../core/errors/app-error.js";
import { backupRepository } from "./backup.repository.js";
import { createBackupSchema } from "./backup.entity.js";
import { auditService } from "../../core/audit/audit.service.js";
import { logger } from "../../core/logger/logger.js";
export class BackupService {
    async createBackup(input, audit) {
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
    async listBackups(options = {}) {
        return backupRepository.list({
            page: options.page,
            limit: options.limit,
            sortBy: "createdAt",
            sortDir: "desc",
        });
    }
    async getBackup(id) {
        const backup = await backupRepository.findById(id);
        if (!backup)
            throw AppError.notFound("backup not found");
        return backup;
    }
    async getDownload(id) {
        const backup = await this.getBackup(id);
        return {
            filename: `ledgerflow-backup-${backup.createdAt.slice(0, 10)}.json`,
            json: JSON.stringify({ app: "ledgerflow", version: 1, createdAt: backup.createdAt, data: backup.data }, null, 2),
        };
    }
    async deleteBackup(id, audit) {
        if (!(await backupRepository.findById(id)))
            throw AppError.notFound("backup not found");
        await backupRepository.delete(id);
        await auditService.log(audit, "delete:backup", "backup", id);
        return { id };
    }
    /** Full restore: replaces the entire dataset with a backup's snapshot. */
    async restoreFromBackup(backupId, audit) {
        const backup = await backupRepository.findById(backupId);
        if (!backup)
            throw AppError.notFound("backup not found");
        await this.importAll(backup.data);
        const restored = Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0);
        await auditService.log(audit, "restore:from-backup", "restore", backupId, { restored });
        logger.info({ backupId, restored }, "Database restored from backup");
        return { restored };
    }
    /** Raw restore from an uploaded JSON payload. */
    async restoreFromPayload(data, audit) {
        if (!data || typeof data !== "object") {
            throw AppError.badRequest("Invalid restore payload");
        }
        await this.importAll(data);
        const restored = Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
        await auditService.log(audit, "restore:from-payload", "restore", undefined, { restored });
        logger.info({ restored }, "Database restored from payload");
        return { restored };
    }
    /** Serialize the full database snapshot from Prisma. */
    async exportAll() {
        const { prisma } = await import("../../core/database/prisma.js");
        const { resetCompanyCache } = await import("../../core/database/company.js");
        resetCompanyCache();
        const tables = [
            "company", "permission", "role", "rolePermission", "user", "authSession",
            "party", "category", "unit", "product", "warehouse", "stockItem", "stockMovement",
            "invoice", "invoiceLine", "invoicePayment", "treasuryAccount", "treasuryTransaction",
            "account", "costCenter", "journalEntry", "journalDetail", "asset", "report", "setting",
            "backup",
        ];
        const db = prisma;
        const out = {};
        for (const table of tables) {
            const rows = await db[table].findMany();
            out[table] = rows;
        }
        return out;
    }
    /** Wipe and re-import a snapshot into Prisma (inside one transaction). */
    async importAll(data) {
        const { runInTransaction } = await import("../../core/database/prisma.js");
        const { getDb } = await import("../../core/database/prisma.js");
        const { resetCompanyCache } = await import("../../core/database/company.js");
        if (!data || typeof data !== "object")
            throw AppError.badRequest("Invalid restore payload");
        await runInTransaction(async () => {
            const deleteTables = [
                "journalDetail", "journalEntry", "asset", "costCenter", "account", "invoicePayment",
                "invoiceLine", "invoice", "treasuryTransaction", "treasuryAccount", "stockMovement",
                "stockItem", "warehouse", "product", "unit", "category", "party", "authSession",
                "user", "rolePermission", "role", "permission", "company", "report", "setting",
                "backup",
            ];
            const createTables = [
                "company", "permission", "role", "rolePermission", "user", "authSession",
                "party", "category", "unit", "product", "warehouse", "stockItem", "stockMovement",
                "account", "costCenter", "asset", "journalEntry", "journalDetail",
                "treasuryAccount", "treasuryTransaction", "invoice", "invoiceLine", "invoicePayment",
                "report", "setting", "backup",
            ];
            const db = getDb();
            for (const table of deleteTables) {
                await db[table].deleteMany();
            }
            for (const table of createTables) {
                const rows = data[table] ?? [];
                if (rows.length === 0)
                    continue;
                await db[table].createMany({ data: rows });
            }
            resetCompanyCache();
        });
    }
}
export const backupService = new BackupService();
