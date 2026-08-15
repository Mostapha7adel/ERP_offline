import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { FiscalYear } from "./fiscal-year.entity.js";

type Row = Record<string, unknown>;

export class FiscalYearRepository extends PrismaRepository<FiscalYear> {
  protected model = "fiscalYear";
  protected dateFields = ["startDate", "endDate", "closedAt"];
  protected searchFields = ["name", "notes"];

  protected toEntity(row: Row): FiscalYear {
    return {
      id: String(row.id),
      name: String(row.name),
      startDate: this.toISO(row.startDate)!,
      endDate: this.toISO(row.endDate)!,
      status: row.status as FiscalYear["status"],
      closingJournalId: row.closingJournalId ? String(row.closingJournalId) : undefined,
      closedAt: this.toISO(row.closedAt),
      closedBy: row.closedBy ? String(row.closedBy) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  /** A closed fiscal year whose [startDate, endDate] contains the given ISO date. */
  async findClosedContaining(date: string): Promise<FiscalYear | undefined> {
    const all = await this.findAll();
    return all.find((f) => f.status === "closed" && f.startDate <= date && date <= f.endDate);
  }

  async findAllOpen(): Promise<FiscalYear[]> {
    const all = await this.findAll();
    return all.filter((f) => f.status === "open");
  }
}

export const fiscalYearRepository = new FiscalYearRepository();
