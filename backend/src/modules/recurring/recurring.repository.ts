import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { RecurringInvoice, RecurringInvoiceLine } from "./recurring.entity.js";
import type { InvoiceType } from "../trade/invoice.entity.js";

type Row = Record<string, unknown>;

export class RecurringInvoiceRepository extends PrismaRepository<RecurringInvoice> {
  protected model = "recurringInvoice";
  protected dateFields = ["nextRunDate", "lastRunAt"];
  protected include = { lines: true };

  protected toEntity(row: Row): RecurringInvoice {
    const rawLines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(row.id),
      type: row.type as InvoiceType,
      number: String(row.number),
      partyId: row.partyId ? String(row.partyId) : undefined,
      warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
      frequency: row.frequency as RecurringInvoice["frequency"],
      interval: Number(row.interval),
      nextRunDate: this.toISO(row.nextRunDate)!,
      lastRunAt: this.toISO(row.lastRunAt),
      lines: rawLines.map((l) => this.toLine(l)),
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      total: Number(row.total),
      isActive: Boolean(row.isActive),
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private toLine(l: Record<string, unknown>): RecurringInvoiceLine {
    return {
      id: String(l.id),
      productId: l.productId ? String(l.productId) : undefined,
      productName: String(l.productName),
      description: l.description ? String(l.description) : undefined,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discount: Number(l.discount),
      taxRate: Number(l.taxRate),
      lineTotal: Number(l.lineTotal),
    };
  }

  private toLineCreate(l: RecurringInvoiceLine): Record<string, unknown> {
    return {
      productId: l.productId ?? null,
      productName: l.productName,
      description: l.description ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      taxRate: l.taxRate,
      lineTotal: l.lineTotal,
    };
  }

  protected toCreateData(data: Omit<RecurringInvoice, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      lines: { create: (lines ?? []).map((l) => this.toLineCreate(l)) },
    };
  }

  protected toUpdateData(data: Partial<Omit<RecurringInvoice, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(lines !== undefined ? { lines: { deleteMany: {}, create: lines.map((l) => this.toLineCreate(l)) } } : {}),
    };
  }

  async findByNumber(number: string): Promise<RecurringInvoice | undefined> {
    const rows = await this.delegate.findFirst({
      where: { ...this.baseWhere(), number },
      include: this.include,
    });
    return rows ? this.toEntity(rows as Row) : undefined;
  }

  async nextNumber(type: InvoiceType): Promise<string> {
    const prefix = type === "sales" ? "REC" : "RECP";
    const count = await this.delegate.count({ where: { ...this.baseWhere(), type } });
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }
}

export const recurringInvoiceRepository = new RecurringInvoiceRepository();
