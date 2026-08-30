import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Budget } from "./budget.entity.js";

type Row = Record<string, unknown>;

export class BudgetRepository extends PrismaRepository<Budget> {
  protected model = "budget";
  protected searchFields = ["period", "notes"];

  protected toEntity(row: Row): Budget {
    return {
      id: String(row.id),
      accountId: String(row.accountId),
      period: String(row.period),
      amount: Number(row.amount),
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByAccountAndPeriod(accountId: string, period: string): Promise<Budget | undefined> {
    const all = await this.findAll();
    return all.find((b) => b.accountId === accountId && b.period === period);
  }

  async byPeriod(period: string): Promise<Budget[]> {
    const all = await this.findAll();
    return all.filter((b) => b.period === period);
  }

  async byAccount(accountId: string): Promise<Budget[]> {
    const all = await this.findAll();
    return all.filter((b) => b.accountId === accountId);
  }
}

export const budgetRepository = new BudgetRepository();
