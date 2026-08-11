import { PrismaRepository } from "../../core/repository/base-repository.js";
export class SettingsRepository extends PrismaRepository {
    model = "setting";
    searchFields = ["key", "group"];
    toEntity(row) {
        return {
            id: String(row.id),
            key: String(row.key),
            value: this.parseValue(row.value),
            group: String(row.group),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    parseValue(raw) {
        if (raw == null)
            return undefined;
        const text = String(raw);
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    serializeValue(value) {
        if (typeof value === "string")
            return value;
        return JSON.stringify(value);
    }
    toCreateData(data) {
        return { ...data, value: this.serializeValue(data.value) };
    }
    toUpdateData(data) {
        return {
            ...data,
            value: data.value !== undefined ? this.serializeValue(data.value) : undefined,
        };
    }
    async findByKey(key) {
        const all = await this.findAll();
        return all.find((s) => s.key === key);
    }
    async set(key, value, group = "general") {
        const existing = await this.findByKey(key);
        if (existing) {
            const updated = await this.update({ id: existing.id, data: { value, group } });
            return updated;
        }
        return this.create({ data: { key, value, group } });
    }
    async get(key) {
        return (await this.findByKey(key))?.value;
    }
    async getAll() {
        const out = {};
        for (const s of await this.findAll()) {
            out[s.key] = s.value;
        }
        return out;
    }
}
export const settingsRepository = new SettingsRepository();
