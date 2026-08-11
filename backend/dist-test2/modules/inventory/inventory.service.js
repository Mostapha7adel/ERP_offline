import { AppError } from "../../core/errors/app-error.js";
import { stockItemRepository, stockMovementRepository } from "./inventory.repository.js";
/**
 * Applies a signed quantity change to a product's stock in a warehouse and
 * records a movement. Negative changes are rejected if they would drive stock
 * below zero (unless `allowNegative` is explicitly true).
 */
export async function applyStockChange(adjustment, createdBy, opts = {}) {
    const { productId, warehouseId, quantity, reason, note } = adjustment;
    const item = await stockItemRepository.ensure(productId, warehouseId);
    const newQuantity = item.quantityOnHand + quantity;
    if (!opts.allowNegative && newQuantity < 0) {
        throw AppError.badRequest(`Insufficient stock for product "${productId}" in warehouse "${warehouseId}"`);
    }
    await stockItemRepository.update({
        id: item.id,
        data: {
            quantityOnHand: Math.max(0, newQuantity),
            averageCost: opts.cost !== undefined ? opts.cost : item.averageCost,
        },
    });
    await stockMovementRepository.create({
        data: {
            productId,
            warehouseId,
            type: opts.type ?? "adjustment",
            quantity,
            reference: reason,
            referenceId: opts.referenceId,
            note,
            cost: opts.cost ?? item.averageCost,
            createdBy,
        },
    });
}
/** Applies a sale/purchase line effect on stock (sale = negative, purchase = positive). */
export async function applyLineStock(productId, warehouseId, quantity, createdBy, opts) {
    if (!productId || !warehouseId)
        return;
    const signed = opts.direction === "out" ? -quantity : quantity;
    await applyStockChange({ productId, warehouseId, quantity: signed, reason: opts.type, note: undefined }, createdBy, {
        type: opts.type,
        allowNegative: opts.direction === "in" || opts.allowNegative === true,
        referenceId: opts.referenceId,
        cost: opts.cost,
    });
}
