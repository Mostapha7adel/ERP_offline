import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Setting } from "./settings.entity.js";

type Row = Record<string, unknown>;

export class SettingsRepository extends PrismaRepository<Setting> {
  protected model = "setting";
  protected searchFields = ["key", "group"];

  protected toEntity(row: Row): Setting {
    return {
      id: String(row.id),
      key: String(row.key),
      value: this.parseValue(row.value),
      group: String(row.group),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private parseValue(raw: unknown): unknown {
    if (raw == null) return undefined;
    const text = String(raw);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private serializeValue(value: unknown): string {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  protected toCreateData(data: Omit<Setting, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    return { ...data, value: this.serializeValue(data.value) };
  }

  protected toUpdateData(data: Partial<Omit<Setting, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    return {
      ...data,
      value: data.value !== undefined ? this.serializeValue(data.value) : undefined,
    };
  }

  async findByKey(key: string): Promise<Setting | undefined> {
    const all = await this.findAll();
    return all.find((s) => s.key === key);
  }

  async set(key: string, value: unknown, group = "general"): Promise<Setting> {
    const existing = await this.findByKey(key);
    if (existing) {
      const updated = await this.update({ id: existing.id, data: { value, group } });
      return updated as Setting;
    }
    return this.create({ data: { key, value, group } });
  }

  async get(key: string): Promise<unknown> {
    return (await this.findByKey(key))?.value;
  }

  async getAll(): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const s of await this.findAll()) {
      out[s.key] = s.value;
    }
    return out;
  }
}

export const settingsRepository = new SettingsRepository();
