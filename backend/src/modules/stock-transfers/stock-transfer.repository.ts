import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { StockTransfer, StockTransferLine } from "./stock-transfer.entity.js";

type Row = Record<string, unknown>;

export class StockTransferRepository extends PrismaRepository<StockTransfer> {
  protected model = "stockTransfer";
  protected dateFields = ["date"];
  protected searchFields = ["reference", "notes"];
  protected include = { lines: true };

  protected toEntity(row: Row): StockTransfer {
    const lines = Array.isArray(row.lines)
      ? (row.lines as Row[]).map((l) => ({
          transferId: String(l.transferId),
          productId: String(l.productId),
          quantity: Number(l.quantity),
        }))
      : [];
    return {
      id: String(row.id),
      fromWarehouseId: String(row.fromWarehouseId),
      toWarehouseId: String(row.toWarehouseId),
      status: row.status as StockTransfer["status"],
      date: this.toISO(row.date)!,
      reference: row.reference ? String(row.reference) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      lines,
    };
  }

  async findByStatus(status: string): Promise<StockTransfer[]> {
    const all = await this.findAll();
    return all.filter((t) => t.status === status);
  }
}

export const stockTransferRepository = new StockTransferRepository();
