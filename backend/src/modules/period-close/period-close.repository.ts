import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { PeriodClose } from "./period-close.entity.js";

type Row = Record<string, unknown>;

export class PeriodCloseRepository extends PrismaRepository<PeriodClose> {
  protected model = "periodClose";
  protected softDelete = false;
  protected dateFields = ["closedAt"];
  protected searchFields = ["period", "notes"];

  protected toEntity(row: Row): PeriodClose {
    return {
      id: String(row.id),
      period: String(row.period),
      status: row.status as PeriodClose["status"],
      closedAt: this.toISO(row.closedAt),
      closedBy: row.closedBy ? String(row.closedBy) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByPeriod(period: string): Promise<PeriodClose | undefined> {
    const row = await this.delegate.findFirst({
      where: { ...this.baseWhere(), period },
    });
    return row ? this.toEntity(row as Row) : undefined;
  }

  async findOpenBefore(period: string): Promise<PeriodClose | undefined> {
    const row = await this.delegate.findFirst({
      where: {
        ...this.baseWhere(),
        status: "open",
        period: { lt: period },
      },
      orderBy: { period: "desc" },
    });
    return row ? this.toEntity(row as Row) : undefined;
  }

  async findMostRecentClosed(): Promise<PeriodClose | undefined> {
    const row = await this.delegate.findFirst({
      where: { ...this.baseWhere(), status: "closed" },
      orderBy: { period: "desc" },
    });
    return row ? this.toEntity(row as Row) : undefined;
  }
}

export const periodCloseRepository = new PeriodCloseRepository();
