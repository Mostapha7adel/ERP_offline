import { AppError } from "../../core/errors/app-error.js";
import { stockItemRepository, stockMovementRepository, batchRepository } from "./inventory.repository.js";
import { productRepository } from "../products/product.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import type { AuthPrincipal } from "../../core/security/rbac.js";
import type { MovementType } from "./inventory.entity.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface StockAdjustment {
  productId: string;
  warehouseId: string;
  quantity: number; // signed delta applied to stock
  reason: string;
  note?: string;
}

/**
 * Check whether a stock item dropped to (or below) its reorder level and, if
 * so, write a "low stock" notification. Only fires on the transition into the
 * low-stock zone (previous quantity above, new quantity at/below the level) so
 * repeated movements while already low do not spam the feed.
 */
async function notifyLowStockIfNeeded(input: {
  productId: string;
  previousQuantity: number;
  newQuantity: number;
  actor?: AuthPrincipal;
}): Promise<void> {
  const { productId, previousQuantity, newQuantity, actor } = input;
  if (newQuantity >= previousQuantity) return; // stock went up or stayed
  try {
    const product = await productRepository.findById(productId);
    if (!product || !product.trackStock) return;
    const level = product.reorderLevel ?? 0;
    if (level <= 0) return; // no threshold configured
    if (previousQuantity <= level || newQuantity > level) return; // only crossing into low
    await notificationService.create({
      kind: "warning",
      title: "Low stock",
      message: `${product.name} is at ${Math.max(0, newQuantity)} units (reorder at ${level})`,
      resource: "product",
      resourceId: productId,
      actor,
    });
  } catch {
    // Notifications must never break the stock update.
  }
}

/**
 * Applies a signed quantity change to a product's stock in a warehouse and
 * records a movement. Negative changes are rejected if they would drive stock
 * below zero (unless `allowNegative` is explicitly true).
 */
export async function applyStockChange(
  adjustment: StockAdjustment,
  createdBy: string,
  opts: { type?: MovementType; allowNegative?: boolean; referenceId?: string; cost?: number; actor?: AuthPrincipal } = {},
): Promise<void> {
  const { productId, warehouseId, quantity, reason, note } = adjustment;
  const item = await stockItemRepository.ensure(productId, warehouseId);

  const newQuantity = item.quantityOnHand + quantity;
  if (!opts.allowNegative && newQuantity < 0) {
    throw AppError.badRequest(
      `Insufficient stock for product "${productId}" in warehouse "${warehouseId}"`,
    );
  }

  // Weighted average cost on stock-in: (old qty * old avg + new qty * cost)
  // / (old qty + new qty). Stock-out (e.g. a sale) leaves the average intact.
  let averageCost = item.averageCost;
  if (opts.cost !== undefined && quantity > 0) {
    const newQty = Math.max(0, newQuantity);
    averageCost = newQty > 0
      ? round2((item.averageCost * item.quantityOnHand + opts.cost * quantity) / newQty)
      : opts.cost;
  }

  await stockItemRepository.update({
    id: item.id,
    data: {
      quantityOnHand: Math.max(0, newQuantity),
      averageCost,
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

  await notifyLowStockIfNeeded({
    productId,
    previousQuantity: item.quantityOnHand,
    newQuantity: Math.max(0, newQuantity),
    actor: opts.actor,
  });
}

/** Applies a sale/purchase line effect on stock (sale = negative, purchase = positive). */
export async function applyLineStock(
  productId: string | undefined,
  warehouseId: string | undefined,
  quantity: number,
  createdBy: string,
  opts: { direction: "out" | "in"; type: MovementType; referenceId?: string; cost?: number; allowNegative?: boolean; actor?: AuthPrincipal },
): Promise<void> {
  if (!productId || !warehouseId) return;
  const signed = opts.direction === "out" ? -quantity : quantity;
  await applyStockChange(
    { productId, warehouseId, quantity: signed, reason: opts.type, note: undefined },
    createdBy,
    {
      type: opts.type,
      allowNegative: opts.direction === "in" || opts.allowNegative === true,
      referenceId: opts.referenceId,
      cost: opts.cost,
      actor: opts.actor,
    },
  );
}

/** Record a received batch (purchase stock-in) with optional expiry and unit cost. */
export async function recordBatch(input: {
  productId: string;
  warehouseId: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string;
  unitCost?: number;
  createdBy: string;
}): Promise<void> {
  const { productId, warehouseId, batchNumber, quantity, expiryDate, unitCost, createdBy } = input;
  if (quantity <= 0) return;
  const existing = await batchRepository.findByBatchNumber(productId, warehouseId, batchNumber);
  if (existing) {
    await batchRepository.update({
      id: existing.id,
      data: {
        quantity: existing.quantity + quantity,
        ...(unitCost !== undefined ? { unitCost } : {}),
      },
    });
  } else {
    await batchRepository.create({
      data: {
        productId,
        warehouseId,
        batchNumber,
        quantity,
        unitCost: unitCost ?? 0,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        receivedAt: new Date().toISOString(),
        createdBy,
      },
    });
  }
}

/**
 * Deduct stock-out from batches using FEFO (earliest expiry first, then oldest).
 * Returns the cost of goods sold based on the FIFO layer costs consumed.
 */
export async function consumeBatches(
  productId: string,
  warehouseId: string,
  quantity: number,
): Promise<number> {
  if (quantity <= 0) return 0;
  let remaining = quantity;
  let cogs = 0;
  const batches = (await batchRepository.byProductWarehouse(productId, warehouseId)).sort((a, b) => {
    if (a.expiryDate && b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
    if (a.expiryDate) return -1;
    if (b.expiryDate) return 1;
    return a.receivedAt.localeCompare(b.receivedAt);
  });
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    if (take > 0) {
      await batchRepository.update({ id: batch.id, data: { quantity: batch.quantity - take } });
      cogs += take * (batch.unitCost ?? 0);
      remaining -= take;
    }
  }
  return Math.round(cogs * 100) / 100;
}
