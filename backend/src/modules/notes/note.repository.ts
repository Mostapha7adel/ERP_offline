import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { TradeNote, TradeNoteLine } from "./note.entity.js";

type Row = Record<string, unknown>;

export class NoteRepository extends PrismaRepository<TradeNote> {
  protected model = "tradeNote";
  protected dateFields = ["noteDate"];
  protected include = { lines: true };

  protected toEntity(row: Row): TradeNote {
    const rawLines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(row.id),
      type: row.type as TradeNote["type"],
      noteType: row.noteType as TradeNote["noteType"],
      number: String(row.number),
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      partyId: row.partyId ? String(row.partyId) : undefined,
      warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
      noteDate: this.toISO(row.noteDate)!,
      lines: rawLines.map((l) => this.toLine(l)),
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      total: Number(row.total),
      status: row.status as TradeNote["status"],
      reason: row.reason ? String(row.reason) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private toLine(l: Record<string, unknown>): TradeNoteLine {
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

  private toLineCreate(l: TradeNoteLine): Record<string, unknown> {
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

  protected toCreateData(data: Omit<TradeNote, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      lines: { create: (lines ?? []).map((l) => this.toLineCreate(l)) },
    };
  }

  protected toUpdateData(data: Partial<Omit<TradeNote, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(lines !== undefined ? { lines: { deleteMany: {}, create: lines.map((l) => this.toLineCreate(l)) } } : {}),
    };
  }

  async findByNumber(number: string): Promise<TradeNote | undefined> {
    const rows = await this.delegate.findFirst({
      where: { ...this.baseWhere(), number },
      include: this.include,
    });
    return rows ? this.toEntity(rows as Row) : undefined;
  }

  async nextNumber(type: TradeNote["type"], noteType: TradeNote["noteType"]): Promise<string> {
    const prefix = `${type === "sales" ? "" : "P"}${noteType === "credit" ? "CN" : "DN"}`;
    const count = await this.delegate.count({ where: { ...this.baseWhere(), type, noteType } });
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }

  async byParty(partyId: string, type?: TradeNote["type"]): Promise<TradeNote[]> {
    const all = await this.findAll();
    return all.filter((n) => n.partyId === partyId && n.status !== "void" && (!type || n.type === type));
  }

  async byInvoice(invoiceId: string): Promise<TradeNote[]> {
    const all = await this.findAll();
    return all.filter((n) => n.invoiceId === invoiceId && n.status !== "void");
  }
}

export const noteRepository = new NoteRepository();
