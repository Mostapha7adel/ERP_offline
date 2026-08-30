import { AppError } from "../../core/errors/app-error.js";
import { budgetRepository } from "./budget.repository.js";
import { budgetCreateSchema, budgetUpdateSchema, type BudgetCreateInput, type BudgetUpdateInput } from "./budget.schema.js";
import type { Budget } from "./budget.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { accountRepository } from "../accounting/accounting.repository.js";
import { journalEntryRepository } from "../accounting/accounting.repository.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export class BudgetService {
  async create(input: BudgetCreateInput, audit: AuditContext): Promise<Budget> {
    const validated = budgetCreateSchema.parse(input);
    const account = await accountRepository.findById(validated.accountId);
    if (!account) throw AppError.badRequest("Account not found");

    const existing = await budgetRepository.findByAccountAndPeriod(validated.accountId, validated.period);
    if (existing) {
      throw AppError.conflict(`Budget already exists for account "${account.name}" in period ${validated.period}`);
    }

    const principalId = audit.principal?.sub ?? "system";
    const budget = await budgetRepository.create({
      data: {
        accountId: validated.accountId,
        period: validated.period,
        amount: validated.amount,
        notes: validated.notes,
        createdBy: principalId,
      },
    });

    void auditService.log(audit, "create:budget", "budget", budget.id, {
      accountId: validated.accountId,
      period: validated.period,
      amount: validated.amount,
    });

    return budget;
  }

  async update(id: string, input: BudgetUpdateInput, audit: AuditContext): Promise<Budget> {
    const existing = await budgetRepository.findById(id);
    if (!existing) throw AppError.notFound("Budget not found");
    const validated = budgetUpdateSchema.parse(input);

    const updated = await budgetRepository.update({
      id,
      data: {
        amount: validated.amount,
        notes: validated.notes,
      },
    });

    void auditService.log(audit, "update:budget", "budget", id);
    return updated as Budget;
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await budgetRepository.findById(id);
    if (!existing) throw AppError.notFound("Budget not found");
    await budgetRepository.delete(id);
    void auditService.log(audit, "delete:budget", "budget", id);
    return { id };
  }

  async getById(id: string): Promise<Budget> {
    const budget = await budgetRepository.findById(id);
    if (!budget) throw AppError.notFound("Budget not found");
    return budget;
  }

  async list(options: { page?: number; limit?: number; search?: string } = {}) {
    return budgetRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["period", "notes"],
    });
  }

  async getActuals(period: string): Promise<Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePercent: number;
  }>> {
    const budgets = await budgetRepository.byPeriod(period);
    const results: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      budgeted: number;
      actual: number;
      variance: number;
      variancePercent: number;
    }> = [];

    for (const budget of budgets) {
      const account = await accountRepository.findById(budget.accountId);
      if (!account) continue;

      const journals = await journalEntryRepository.byDateRange(
        `${period}-01T00:00:00.000Z`,
        `${period}-31T23:59:59.999Z`,
      );

      let actualDebit = 0;
      let actualCredit = 0;
      for (const journal of journals) {
        for (const line of journal.lines) {
          if (line.accountCode === account.code) {
            actualDebit += line.debit;
            actualCredit += line.credit;
          }
        }
      }

      const actual = account.type === "expense" || account.type === "asset"
        ? round2(actualDebit - actualCredit)
        : round2(actualCredit - actualDebit);

      const variance = round2(budget.amount - actual);
      const variancePercent = budget.amount !== 0
        ? round2((variance / budget.amount) * 100)
        : 0;

      results.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        budgeted: round2(budget.amount),
        actual,
        variance,
        variancePercent,
      });
    }

    return results;
  }
}

export const budgetService = new BudgetService();
