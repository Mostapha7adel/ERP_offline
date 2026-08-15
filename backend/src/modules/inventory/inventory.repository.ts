import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { StockItem, StockMovement, Batch } from "./inventory.entity.js";

type Row = Record<string, unknown>;

/** Map entity movement types to Prisma enum values (kebab-case → camelCase). */
const MOVE_TO_DB: Record<string, string> = {
  initial: "initial",
  purchase: "purchase",
  sale: "sale",
  adjustment: "adjustment",
  "transfer-in": "transferIn",
  "transfer-out": "transferOut",
  return: "return",
  "write-off": "writeOff",
};

const MOVE_FROM_DB: Record<string, string> = {
  initial: "initial",
  purchase: "purchase",
  sale: "sale",
  adjustment: "adjustment",
  transferIn: "transfer-in",
  transferOut: "transfer-out",
  return: "return",
  writeOff: "write-off",
};

export class StockItemRepository extends PrismaRepository<StockItem> {
  protected model = "stockItem";
  protected searchFields = ["productId", "warehouseId"];

  protected toEntity(row: Row): StockItem {
    return {
      id: String(row.id),
      productId: String(row.productId),
      warehouseId: String(row.warehouseId),
      quantityOnHand: Number(row.quantityOnHand),
      reservedQuantity: Number(row.reservedQuantity),
      reorderLevel: Number(row.reorderLevel),
      averageCost: Number(row.averageCost),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByProductWarehouse(productId: string, warehouseId: string): Promise<StockItem | undefined> {
    const rows = await this.delegate.findMany({
      where: { ...this.baseWhere(), productId, warehouseId },
    });
    if (rows.length === 0) return undefined;
    return this.toEntity(rows[0] as Row);
  }

  async findByProduct(productId: string): Promise<StockItem[]> {
    const all = await this.findAll();
    return all.filter((s) => s.productId === productId);
  }

  async byWarehouse(warehouseId: string): Promise<StockItem[]> {
    const all = await this.findAll();
    return all.filter((s) => s.warehouseId === warehouseId);
  }

  /** Ensure a stock record exists for a product/warehouse pair. */
  async ensure(productId: string, warehouseId: string, reorderLevel = 0): Promise<StockItem> {
    const existing = await this.findByProductWarehouse(productId, warehouseId);
    if (existing) return existing;
    return this.create({
      data: {
        productId,
        warehouseId,
        quantityOnHand: 0,
        reservedQuantity: 0,
        reorderLevel,
        averageCost: 0,
      },
    });
  }
}

export class StockMovementRepository extends PrismaRepository<StockMovement> {
  protected model = "stockMovement";
  protected searchFields = ["reference", "referenceId", "note"];

  protected toEntity(row: Row): StockMovement {
    return {
      id: String(row.id),
      productId: String(row.productId),
      warehouseId: String(row.warehouseId),
      type: (MOVE_FROM_DB[String(row.type)] ?? String(row.type)) as StockMovement["type"],
      quantity: Number(row.quantity),
      reference: row.reference ? String(row.reference) : undefined,
      referenceId: row.referenceId ? String(row.referenceId) : undefined,
      note: row.note ? String(row.note) : undefined,
      cost: Number(row.cost),
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  protected toCreateData(data: Omit<StockMovement, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    return { ...data, type: MOVE_TO_DB[data.type] ?? data.type };
  }

  protected toUpdateData(data: Partial<Omit<StockMovement, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    return { ...data, type: data.type ? MOVE_TO_DB[data.type] ?? data.type : undefined };
  }

  async byProduct(productId: string): Promise<StockMovement[]> {
    const all = await this.findAll();
    return all.filter((m) => m.productId === productId);
  }
}

export class BatchRepository extends PrismaRepository<Batch> {
  protected model = "batch";
  protected searchFields = ["batchNumber", "productId"];

  protected toEntity(row: Row): Batch {
    return {
      id: String(row.id),
      productId: String(row.productId),
      warehouseId: String(row.warehouseId),
      batchNumber: String(row.batchNumber),
      quantity: Number(row.quantity),
      expiryDate: this.toISO(row.expiryDate),
      receivedAt: this.toISO(row.receivedAt)!,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async byProductWarehouse(productId: string, warehouseId: string): Promise<Batch[]> {
    const all = await this.findAll();
    return all.filter((b) => b.productId === productId && b.warehouseId === warehouseId);
  }

  async findByBatchNumber(productId: string, warehouseId: string, batchNumber: string): Promise<Batch | undefined> {
    const all = await this.findAll();
    return all.find(
      (b) => b.productId === productId && b.warehouseId === warehouseId && b.batchNumber === batchNumber,
    );
  }
}

export const stockItemRepository = new StockItemRepository();
export const stockMovementRepository = new StockMovementRepository();
export const batchRepository = new BatchRepository();
