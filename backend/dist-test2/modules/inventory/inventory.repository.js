import { PrismaRepository } from "../../core/repository/base-repository.js";
/** Map entity movement types to Prisma enum values (kebab-case → camelCase). */
const MOVE_TO_DB = {
    initial: "initial",
    purchase: "purchase",
    sale: "sale",
    adjustment: "adjustment",
    "transfer-in": "transferIn",
    "transfer-out": "transferOut",
    return: "return",
    "write-off": "writeOff",
};
const MOVE_FROM_DB = {
    initial: "initial",
    purchase: "purchase",
    sale: "sale",
    adjustment: "adjustment",
    transferIn: "transfer-in",
    transferOut: "transfer-out",
    return: "return",
    writeOff: "write-off",
};
export class StockItemRepository extends PrismaRepository {
    model = "stockItem";
    searchFields = ["productId", "warehouseId"];
    toEntity(row) {
        return {
            id: String(row.id),
            productId: String(row.productId),
            warehouseId: String(row.warehouseId),
            quantityOnHand: Number(row.quantityOnHand),
            reservedQuantity: Number(row.reservedQuantity),
            reorderLevel: Number(row.reorderLevel),
            averageCost: Number(row.averageCost),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async findByProductWarehouse(productId, warehouseId) {
        const rows = await this.delegate.findMany({
            where: { ...this.baseWhere(), productId, warehouseId },
        });
        if (rows.length === 0)
            return undefined;
        return this.toEntity(rows[0]);
    }
    async findByProduct(productId) {
        const all = await this.findAll();
        return all.filter((s) => s.productId === productId);
    }
    async byWarehouse(warehouseId) {
        const all = await this.findAll();
        return all.filter((s) => s.warehouseId === warehouseId);
    }
    /** Ensure a stock record exists for a product/warehouse pair. */
    async ensure(productId, warehouseId, reorderLevel = 0) {
        const existing = await this.findByProductWarehouse(productId, warehouseId);
        if (existing)
            return existing;
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
export class StockMovementRepository extends PrismaRepository {
    model = "stockMovement";
    searchFields = ["reference", "referenceId", "note"];
    toEntity(row) {
        return {
            id: String(row.id),
            productId: String(row.productId),
            warehouseId: String(row.warehouseId),
            type: (MOVE_FROM_DB[String(row.type)] ?? String(row.type)),
            quantity: Number(row.quantity),
            reference: row.reference ? String(row.reference) : undefined,
            referenceId: row.referenceId ? String(row.referenceId) : undefined,
            note: row.note ? String(row.note) : undefined,
            cost: Number(row.cost),
            createdBy: String(row.createdBy),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    toCreateData(data) {
        return { ...data, type: MOVE_TO_DB[data.type] ?? data.type };
    }
    toUpdateData(data) {
        return { ...data, type: data.type ? MOVE_TO_DB[data.type] ?? data.type : undefined };
    }
    async byProduct(productId) {
        const all = await this.findAll();
        return all.filter((m) => m.productId === productId);
    }
}
export const stockItemRepository = new StockItemRepository();
export const stockMovementRepository = new StockMovementRepository();
