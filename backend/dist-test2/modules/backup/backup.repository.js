import { PrismaRepository } from "../../core/repository/base-repository.js";
export class BackupRepository extends PrismaRepository {
    model = "backup";
    searchFields = ["label"];
    toEntity(row) {
        return {
            id: String(row.id),
            label: String(row.label),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
            createdBy: String(row.createdBy),
            sizeBytes: Number(row.sizeBytes),
            recordCount: Number(row.recordCount),
            data: this.parseData(row.data),
        };
    }
    parseData(raw) {
        if (!raw)
            return {};
        try {
            const parsed = JSON.parse(String(raw));
            if (parsed && typeof parsed === "object") {
                return parsed;
            }
        }
        catch {
            // fall through to empty snapshot
        }
        return {};
    }
    toCreateData(data) {
        return { ...data, data: JSON.stringify(data.data ?? {}) };
    }
}
export const backupRepository = new BackupRepository();
