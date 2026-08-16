import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import type { PurchaseOrder, PurchaseOrderLine } from "./purchase-order.entity.js";

type Row = Record<string, unknown>;

export class PurchaseOrderRepository extends PrismaRepository<PurchaseOrder> {
  protected model = "purchaseOrder";
  protected dateFields = ["orderDate", "expectedDate", "approvedAt"];
  protected searchFields = ["number", "notes"];
  protected include = { lines: true };

  protected toEntity(row: Row): PurchaseOrder {
    const rawLines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(row.id),
      number: String(row.number),
      supplierId: row.supplierId ? String(row.supplierId) : undefined,
      warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
      orderDate: this.toISO(row.orderDate)!,
      expectedDate: this.toISO(row.expectedDate),
      status: row.status as PurchaseOrder["status"],
      subtotal: Number(row.subtotal),
      discount: Number(row.discount),
      tax: Number(row.tax),
      total: Number(row.total),
      currency: String(row.currency ?? "EGP"),
      notes: row.notes ? String(row.notes) : undefined,
      approvedBy: row.approvedBy ? String(row.approvedBy) : undefined,
      approvedAt: this.toISO(row.approvedAt),
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      lines: rawLines.map((l) => this.toLine(l)),
    };
  }

  private toLine(l: Record<string, unknown>): PurchaseOrderLine {
    return {
      id: String(l.id),
      purchaseOrderId: String(l.purchaseOrderId),
      productId: l.productId ? String(l.productId) : undefined,
      productName: String(l.productName),
      description: l.description ? String(l.description) : undefined,
      quantity: Number(l.quantity),
      receivedQty: Number(l.receivedQty),
      unitPrice: Number(l.unitPrice),
      discount: Number(l.discount),
      taxRate: Number(l.taxRate),
      lineTotal: Number(l.lineTotal),
      createdAt: this.toISO(l.createdAt)!,
      updatedAt: this.toISO(l.updatedAt)!,
    };
  }

  private toLineCreate(l: PurchaseOrderLine): Record<string, unknown> {
    return {
      productId: l.productId ?? null,
      productName: l.productName,
      description: l.description ?? null,
      quantity: l.quantity,
      receivedQty: l.receivedQty,
      unitPrice: l.unitPrice,
      discount: l.discount,
      taxRate: l.taxRate,
      lineTotal: l.lineTotal,
    };
  }

  protected toCreateData(data: Omit<PurchaseOrder, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      lines: { create: (lines ?? []).map((l) => this.toLineCreate(l)) },
    };
  }

  protected toUpdateData(data: Partial<Omit<PurchaseOrder, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    const { lines, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(lines !== undefined ? { lines: { deleteMany: {}, create: lines.map((l) => this.toLineCreate(l)) } } : {}),
    };
  }

  async nextNumber(): Promise<string> {
    const prefix = "PO";
    const count = await this.delegate.count({ where: { ...this.baseWhere() } });
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }

  protected async withCompanyId(): Promise<string | undefined> {
    return this.companyScoped ? await getDefaultCompanyId() : undefined;
  }

  async create(input: Parameters<PrismaRepository<PurchaseOrder>["create"]>[0]): Promise<PurchaseOrder> {
    const companyId = await this.withCompanyId();
    const now = input.now ?? new Date().toISOString();
    const { lines, ...rest } = this.toCreateData(input.data);
    const row = await this.delegate.create({
      data: {
        ...rest,
        ...(companyId ? { companyId } : {}),
        lines: {
          create: (lines as unknown as { create: Array<Record<string, unknown>> }).create.map((l) => ({
            ...l,
            ...(companyId ? { companyId } : {}),
          })),
        },
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      ...(this.include ? { include: this.include } : {}),
    });
    return this.rowToEntity(row);
  }

  async update(input: Parameters<PrismaRepository<PurchaseOrder>["update"]>[0]): Promise<PurchaseOrder | undefined> {
    const existing = await this.delegate.findFirst({ where: { ...this.baseWhere(), id: input.id } });
    if (!existing) return undefined;
    const companyId = await this.withCompanyId();
    const now = input.now ?? new Date().toISOString();
    const data = this.toUpdateData(input.data);
    const { lines, ...rest } = data;
    const finalData =
      lines && (lines as unknown as { deleteMany?: unknown }).deleteMany
        ? {
            ...rest,
            lines: {
              ...(lines as object),
              create: ((lines as { create: Array<Record<string, unknown>> }).create ?? []).map((l) => ({
                ...l,
                ...(companyId ? { companyId } : {}),
              })),
            },
          }
        : rest;
    const row = await this.delegate.update({
      where: { id: input.id },
      data: { ...finalData, updatedAt: new Date(now) },
      ...(this.include ? { include: this.include } : {}),
    });
    return this.rowToEntity(row);
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();