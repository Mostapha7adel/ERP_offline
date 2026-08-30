import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { PurchaseReturn, PurchaseReturnLine } from "./purchase-return.entity.js";

type Row = Record<string, unknown>;

export class PurchaseReturnRepository extends PrismaRepository<PurchaseReturn> {
  protected model = "purchaseReturn";
  protected dateFields = ["returnDate"];
  protected include = { lines: true };
  protected searchFields = ["number", "reason", "notes"];

  protected toEntity(row: Row): PurchaseReturn {
    const rawLines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(row.id),
      number: String(row.number),
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      supplierId: row.supplierId ? String(row.supplierId) : undefined,
      warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
      returnDate: this.toISO(row.returnDate)!,
      lines: rawLines.map((l) => this.toLine(l)),
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      total: Number(row.total),
      status: row.status as PurchaseReturn["status"],
      reason: row.reason ? String(row.reason) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private toLine(l: Record<string, unknown>): PurchaseReturnLine {
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

  private toLineCreate(l: PurchaseReturnLine): Record<string, unknown> {
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

  protected toCreateData(data: Omit<PurchaseReturn, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      lines: { create: (lines ?? []).map((l) => this.toLineCreate(l)) },
    };
  }

  protected toUpdateData(data: Partial<Omit<PurchaseReturn, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(lines !== undefined ? { lines: { deleteMany: {}, create: lines.map((l) => this.toLineCreate(l)) } } : {}),
    };
  }

  async nextNumber(): Promise<string> {
    const count = await this.delegate.count({ where: { ...this.baseWhere() } });
    return `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }

  async byInvoice(invoiceId: string): Promise<PurchaseReturn[]> {
    const all = await this.findAll();
    return all.filter((r) => r.invoiceId === invoiceId && r.status !== "void");
  }
}

export const purchaseReturnRepository = new PurchaseReturnRepository();
