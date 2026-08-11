import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Invoice, InvoiceLine } from "./invoice.entity.js";

type Row = Record<string, unknown>;

/** Map user-facing payment methods to Prisma enum values. */
const PAY_TO_DB: Record<string, string> = {
  cash: "cash",
  bank: "bankTransfer",
  bankTransfer: "bankTransfer",
  card: "card",
  check: "check",
  credit: "credit",
  other: "other",
};

const PAY_FROM_DB: Record<string, string> = {
  cash: "cash",
  bankTransfer: "bank",
  card: "card",
  check: "check",
  credit: "credit",
  other: "other",
};

export class InvoiceRepository extends PrismaRepository<Invoice> {
  protected model = "invoice";
  protected dateFields = ["invoiceDate", "dueDate"];
  protected include = { lines: true };

  protected toEntity(row: Row): Invoice {
    const rawLines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(row.id),
      type: row.type as Invoice["type"],
      number: String(row.number),
      customerId: row.customerId ? String(row.customerId) : undefined,
      supplierId: row.supplierId ? String(row.supplierId) : undefined,
      invoiceDate: this.toISO(row.invoiceDate)!,
      dueDate: this.toISO(row.dueDate),
      warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
      lines: rawLines.map((l) => this.toLine(l)),
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      total: Number(row.total),
      paidAmount: Number(row.paidAmount),
      received: Boolean(row.received),
      status: row.status as Invoice["status"],
      paymentMethod: row.paymentMethod ? PAY_FROM_DB[String(row.paymentMethod)] ?? String(row.paymentMethod) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private toLine(l: Record<string, unknown>): InvoiceLine {
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

  private toLineCreate(l: InvoiceLine): Record<string, unknown> {
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

  protected toCreateData(data: Omit<Invoice, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    const { lines, paymentMethod, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(paymentMethod ? { paymentMethod: PAY_TO_DB[paymentMethod] ?? "other" } : {}),
      lines: { create: (lines ?? []).map((l) => this.toLineCreate(l)) },
    };
  }

  protected toUpdateData(data: Partial<Omit<Invoice, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    const { lines, paymentMethod, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(paymentMethod !== undefined ? { paymentMethod: paymentMethod ? PAY_TO_DB[paymentMethod] ?? "other" : null } : {}),
      ...(lines !== undefined ? { lines: { deleteMany: {}, create: lines.map((l) => this.toLineCreate(l)) } } : {}),
    };
  }

  async findByNumber(number: string): Promise<Invoice | undefined> {
    const rows = await this.delegate.findFirst({
      where: { ...this.baseWhere(), number },
      include: this.include,
    });
    return rows ? this.toEntity(rows as Row) : undefined;
  }

  async byType(type: Invoice["type"]): Promise<Invoice[]> {
    const all = await this.findAll();
    return all.filter((inv) => inv.type === type && inv.status !== "void");
  }

  async nextNumber(type: Invoice["type"]): Promise<string> {
    const prefix = type === "sales" ? "INV" : "PUR";
    const count = await this.delegate.count({ where: { ...this.baseWhere(), type } });
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }
}

export const invoiceRepository = new InvoiceRepository();
