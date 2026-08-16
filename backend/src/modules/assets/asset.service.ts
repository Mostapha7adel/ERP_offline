import { AppError } from "../../core/errors/app-error.js";
import { assetRepository, assetDepreciationRunRepository } from "./asset.repository.js";
import {
  assetCreateSchema,
  assetUpdateSchema,
  type AssetCreateInput,
  type AssetUpdateInput,
} from "./asset.schema.js";
import type { Asset } from "./asset.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { accountRepository, journalEntryRepository } from "../accounting/accounting.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { withTransaction } from "../../core/database/transaction.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export class AssetService {
  async create(input: AssetCreateInput, audit: AuditContext): Promise<Asset> {
    const validated = assetCreateSchema.parse(input);
    if (await assetRepository.findByCode(validated.code)) {
      throw AppError.conflict(`Asset code "${validated.code}" already exists`);
    }
    const asset = await assetRepository.create({
      data: {
        code: validated.code,
        name: validated.name,
        category: validated.category,
        purchaseDate: validated.purchaseDate,
        cost: validated.cost,
        salvageValue: validated.salvageValue,
        usefulLifeMonths: validated.usefulLifeMonths,
        depreciationMethod: validated.depreciationMethod,
        currentValue: validated.currentValue ?? validated.cost,
        accountId: validated.accountId,
        accumulatedDepreciationAccountId: validated.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId: validated.depreciationExpenseAccountId,
        status: validated.status,
        notes: validated.notes,
      },
    });
    void auditService.log(audit, "create:asset", "accounting", asset.id, { code: asset.code });
    return asset;
  }

  async update(id: string, input: AssetUpdateInput, audit: AuditContext): Promise<Asset> {
    const existing = await assetRepository.findById(id);
    if (!existing) throw AppError.notFound("asset not found");
    const validated = assetUpdateSchema.parse(input);
    const updated = await assetRepository.update({
      id,
      data: {
        code: validated.code,
        name: validated.name,
        category: validated.category,
        purchaseDate: validated.purchaseDate,
        cost: validated.cost,
        salvageValue: validated.salvageValue,
        usefulLifeMonths: validated.usefulLifeMonths,
        depreciationMethod: validated.depreciationMethod,
        currentValue: validated.currentValue,
        accountId: validated.accountId,
        accumulatedDepreciationAccountId: validated.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId: validated.depreciationExpenseAccountId,
        status: validated.status,
        notes: validated.notes,
      },
    });
    void auditService.log(audit, "update:asset", "accounting", id);
    return updated as Asset;
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await assetRepository.findById(id);
    if (!existing) throw AppError.notFound("asset not found");
    await assetRepository.delete(id);
    void auditService.log(audit, "delete:asset", "accounting", id);
    return { id };
  }

  async getById(id: string): Promise<Asset> {
    const asset = await assetRepository.findById(id);
    if (!asset) throw AppError.notFound("asset not found");
    return asset;
  }

  async list(options: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const result = await assetRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["code", "name", "category"],
      filters: options.status ? { status: [options.status] } : undefined,
    });
    return result;
  }

  /**
   * Run depreciation for a period. Computes the monthly amount, posts a
   * journal entry (debit depreciation expense, credit accumulated depreciation)
   * and records the run. Only runs once per asset + period.
   */
  async depreciate(id: string, period: string | undefined, audit: AuditContext): Promise<{ asset: Asset; run: { period: string; amount: number; accumulated: number } }> {
    const asset = await assetRepository.findById(id);
    if (!asset) throw AppError.notFound("asset not found");
    if (asset.status !== "active") throw AppError.conflict("Only active assets can be depreciated");

    const targetPeriod = period ?? currentPeriod();
    const existing = await assetDepreciationRunRepository.findRun(asset.id, targetPeriod);
    if (existing) throw AppError.conflict(`Depreciation already recorded for ${targetPeriod}`);

    const amount = this.monthlyDepreciation(asset);
    if (amount <= 0) throw AppError.conflict("Asset is fully depreciated or has no depreciable amount");
    const accumulated = round2(await assetDepreciationRunRepository.totalForAsset(asset.id) + amount);
    const bookValue = round2(Math.max(0, asset.cost - accumulated));

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";

      // Resolve the accounting accounts; require a depreciation expense account.
      const expenseAccountId = asset.depreciationExpenseAccountId ?? asset.accountId;
      const accumAccountId = asset.accumulatedDepreciationAccountId;
      if (!expenseAccountId) throw AppError.badRequest("Set a depreciation expense account on the asset first");
      const expenseAccount = await accountRepository.findById(expenseAccountId);
      if (!expenseAccount) throw AppError.badRequest("Depreciation expense account not found");
      let debitCode = expenseAccount.code;
      let creditCode = expenseAccount.code;
      if (accumAccountId) {
        const accumAccount = await accountRepository.findById(accumAccountId);
        if (accumAccount) creditCode = accumAccount.code;
      }

      // Post the double-entry journal.
      const date = `${targetPeriod}-01T00:00:00.000Z`;
      const journal = await journalEntryRepository.create({
        data: {
          number: await journalEntryRepository.nextNumber(),
          date,
          memo: `Depreciation ${targetPeriod} — ${asset.name}`,
          status: "posted",
          lines: [
            { accountCode: debitCode, description: "Depreciation expense", debit: amount, credit: 0 },
            { accountCode: creditCode, description: "Accumulated depreciation", debit: 0, credit: amount },
          ],
          totalDebit: amount,
          totalCredit: amount,
          createdBy: principalId,
        },
      });

      await assetDepreciationRunRepository.create({
        data: {
          assetId: asset.id,
          period: targetPeriod,
          amount,
          accumulated,
          journalId: journal.id,
          createdBy: principalId,
        },
      });

      const updated = await assetRepository.update({
        id: asset.id,
        data: { currentValue: bookValue },
      });

      void auditService.log(audit, "depreciate:asset", "accounting", asset.id, { period: targetPeriod, amount });
      await notificationService.create({
        kind: "info",
        title: "Depreciation recorded",
        message: `${asset.name} — ${amount} for ${targetPeriod}`,
        resource: "asset",
        resourceId: asset.id,
        actor: audit.principal,
      });

      return { asset: updated as Asset, run: { period: targetPeriod, amount, accumulated } };
    });
  }

  /** Monthly straight-line depreciation. */
  private monthlyDepreciation(asset: Asset): number {
    if (asset.usefulLifeMonths <= 0) return 0;
    if (asset.depreciationMethod === "declining") {
      const rate = 2 / asset.usefulLifeMonths;
      return round2(asset.currentValue * rate);
    }
    const depreciable = Math.max(0, asset.cost - asset.salvageValue);
    return round2(depreciable / asset.usefulLifeMonths);
  }

  /** Enrich with depreciation history + names for the frontend. */
  async enrich(asset: Asset) {
    const [runs, accumulated, account, accumAccount, expenseAccount] = await Promise.all([
      assetDepreciationRunRepository.byAsset(asset.id),
      assetDepreciationRunRepository.totalForAsset(asset.id),
      asset.accountId ? accountRepository.findById(asset.accountId) : undefined,
      asset.accumulatedDepreciationAccountId ? accountRepository.findById(asset.accumulatedDepreciationAccountId) : undefined,
      asset.depreciationExpenseAccountId ? accountRepository.findById(asset.depreciationExpenseAccountId) : undefined,
    ]);
    const bookValue = round2(asset.cost - accumulated);
    return {
      ...asset,
      accumulatedDepreciation: round2(accumulated),
      bookValue: round2(asset.currentValue),
      runs: runs.sort((a, b) => b.period.localeCompare(a.period)),
      accountName: account?.name,
      accumulatedDepreciationAccountName: accumAccount?.name,
      depreciationExpenseAccountName: expenseAccount?.name,
      bookValueExpected: bookValue,
    };
  }
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const assetService = new AssetService();