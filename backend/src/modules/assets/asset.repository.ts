import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Asset, AssetDepreciationRun } from "./asset.entity.js";

type Row = Record<string, unknown>;

export class AssetRepository extends PrismaRepository<Asset> {
  protected model = "asset";
  protected dateFields = ["purchaseDate"];
  protected searchFields = ["code", "name", "category"];

  protected toEntity(row: Row): Asset {
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      category: row.category ? String(row.category) : undefined,
      purchaseDate: this.toISO(row.purchaseDate),
      cost: Number(row.cost),
      salvageValue: Number(row.salvageValue),
      usefulLifeMonths: Number(row.usefulLifeMonths),
      depreciationMethod: String(row.depreciationMethod ?? "straight-line"),
      currentValue: Number(row.currentValue),
      accountId: row.accountId ? String(row.accountId) : undefined,
      accumulatedDepreciationAccountId: row.accumulatedDepreciationAccountId ? String(row.accumulatedDepreciationAccountId) : undefined,
      depreciationExpenseAccountId: row.depreciationExpenseAccountId ? String(row.depreciationExpenseAccountId) : undefined,
      status: row.status as Asset["status"],
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByCode(code: string): Promise<Asset | undefined> {
    const all = await this.findAll();
    return all.find((a) => a.code.toLowerCase() === code.toLowerCase());
  }
}

export class AssetDepreciationRunRepository extends PrismaRepository<AssetDepreciationRun> {
  protected model = "assetDepreciationRun";
  protected searchFields = ["assetId", "period"];

  protected toEntity(row: Row): AssetDepreciationRun {
    return {
      id: String(row.id),
      assetId: String(row.assetId),
      period: String(row.period),
      amount: Number(row.amount),
      accumulated: Number(row.accumulated),
      journalId: row.journalId ? String(row.journalId) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async byAsset(assetId: string): Promise<AssetDepreciationRun[]> {
    const all = await this.findAll();
    return all.filter((r) => r.assetId === assetId);
  }

  async totalForAsset(assetId: string): Promise<number> {
    const runs = await this.byAsset(assetId);
    return runs.reduce((s, r) => s + r.amount, 0);
  }

  async findRun(assetId: string, period: string): Promise<AssetDepreciationRun | undefined> {
    const all = await this.findAll();
    return all.find((r) => r.assetId === assetId && r.period === period);
  }
}

export const assetRepository = new AssetRepository();
export const assetDepreciationRunRepository = new AssetDepreciationRunRepository();