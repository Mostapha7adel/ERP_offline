import { AppError } from "../../core/errors/app-error.js";
import { currencyRateRepository } from "./currency.repository.js";
import {
  currencyCreateSchema,
  currencyUpdateSchema,
  type CurrencyCreateInput,
  type CurrencyUpdateInput,
} from "./currency.schema.js";
import type { CurrencyRate } from "./currency.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { settingsRepository } from "../settings/settings.repository.js";

export class CurrencyService {
  async list(): Promise<CurrencyRate[]> {
    const rates = await currencyRateRepository.findAll();
    if (rates.length > 0) return rates;
    // Seed sensible defaults from company settings when none exist yet.
    const currency = (await settingsRepository.get("company.currency")) as string | undefined;
    const code = (currency ?? "EGP").toUpperCase();
    const seeds = [
      { code, name: code === "EGP" ? "Egyptian Pound" : code, rate: 1, isBase: true },
      { code: "USD", name: "US Dollar", symbol: "$", rate: 30, isBase: false },
      { code: "EUR", name: "Euro", symbol: "€", rate: 33, isBase: false },
      { code: "SAR", name: "Saudi Riyal", symbol: "﷼", rate: 8, isBase: false },
    ].filter((s, i, arr) => s.code === code || !arr.some((x) => x.code === code && x.isBase));
    return seeds.map((s) => ({
      id: `seed-${s.code}`,
      code: s.code,
      name: s.name,
      symbol: s.symbol,
      rate: s.rate,
      isBase: s.isBase,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  async create(input: CurrencyCreateInput, audit: AuditContext): Promise<CurrencyRate> {
    const validated = currencyCreateSchema.parse(input);
    const code = validated.code.toUpperCase();
    const existing = await currencyRateRepository.findByCode(code);
    if (existing) throw AppError.conflict(`Currency "${code}" already exists`);
    if (validated.isBase) {
      await this.clearBase();
    }
    const rate = await currencyRateRepository.create({
      data: {
        code,
        name: validated.name,
        symbol: validated.symbol,
        rate: validated.rate,
        isBase: validated.isBase ?? false,
      },
    });
    void auditService.log(audit, "create:currency", "settings", rate.id, { code });
    return rate;
  }

  async update(id: string, input: CurrencyUpdateInput, audit: AuditContext): Promise<CurrencyRate> {
    const existing = await currencyRateRepository.findById(id);
    if (!existing) throw AppError.notFound("currency not found");
    const validated = currencyUpdateSchema.parse(input);
    if (validated.isBase) {
      await this.clearBase();
    }
    const updated = await currencyRateRepository.update({
      id,
      data: {
        code: validated.code ? validated.code.toUpperCase() : undefined,
        name: validated.name,
        symbol: validated.symbol,
        rate: validated.rate,
        isBase: validated.isBase,
      },
    });
    void auditService.log(audit, "update:currency", "settings", id);
    return updated as CurrencyRate;
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await currencyRateRepository.findById(id);
    if (!existing) throw AppError.notFound("currency not found");
    if (existing.isBase) throw AppError.conflict("Cannot delete the base currency");
    await currencyRateRepository.delete(id);
    void auditService.log(audit, "delete:currency", "settings", id);
    return { id };
  }

  /** Convert an amount from a currency into the base currency. */
  async toBase(amount: number, code: string): Promise<number> {
    const rate = await currencyRateRepository.findByCode(code);
    if (!rate) return amount;
    return Math.round((amount * rate.rate) * 100) / 100;
  }

  private async clearBase(): Promise<void> {
    const current = await currencyRateRepository.findBase();
    if (current) {
      await currencyRateRepository.update({ id: current.id, data: { isBase: false } });
    }
  }
}

export const currencyService = new CurrencyService();