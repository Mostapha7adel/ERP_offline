import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Quote, QuoteLine } from "./quote.entity.js";
import type { InvoiceType } from "../trade/invoice.entity.js";

type Row = Record<string, unknown>;

export class QuoteRepository extends PrismaRepository<Quote> {
  protected model = "quote";
  protected dateFields = ["quoteDate", "validUntil"];
  protected include = { lines: true };

  protected toEntity(row: Row): Quote {
    const rawLines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(row.id),
      type: row.type as InvoiceType,
      number: String(row.number),
      partyId: row.partyId ? String(row.partyId) : undefined,
      quoteDate: this.toISO(row.quoteDate)!,
      validUntil: this.toISO(row.validUntil),
      warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
      lines: rawLines.map((l) => this.toLine(l)),
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      total: Number(row.total),
      status: row.status as Quote["status"],
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private toLine(l: Record<string, unknown>): QuoteLine {
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

  private toLineCreate(l: QuoteLine): Record<string, unknown> {
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

  protected toCreateData(data: Omit<Quote, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      lines: { create: (lines ?? []).map((l) => this.toLineCreate(l)) },
    };
  }

  protected toUpdateData(data: Partial<Omit<Quote, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(lines !== undefined ? { lines: { deleteMany: {}, create: lines.map((l) => this.toLineCreate(l)) } } : {}),
    };
  }

  async nextNumber(type: InvoiceType): Promise<string> {
    const prefix = type === "sales" ? "QT" : "PQ";
    const count = await this.delegate.count({ where: { ...this.baseWhere(), type } });
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }
}

export const quoteRepository = new QuoteRepository();
