import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { CurrencyRate } from "./currency.entity.js";

type Row = Record<string, unknown>;

export class CurrencyRateRepository extends PrismaRepository<CurrencyRate> {
  protected model = "currencyRate";
  protected searchFields = ["code", "name"];

  protected toEntity(row: Row): CurrencyRate {
    return {
      id: String(row.id),
      code: String(row.code),
      name: row.name ? String(row.name) : undefined,
      symbol: row.symbol ? String(row.symbol) : undefined,
      rate: Number(row.rate),
      isBase: Boolean(row.isBase),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByCode(code: string): Promise<CurrencyRate | undefined> {
    const all = await this.findAll();
    return all.find((c) => c.code.toLowerCase() === code.toLowerCase());
  }

  async findBase(): Promise<CurrencyRate | undefined> {
    const all = await this.findAll();
    return all.find((c) => c.isBase);
  }
}

export const currencyRateRepository = new CurrencyRateRepository();