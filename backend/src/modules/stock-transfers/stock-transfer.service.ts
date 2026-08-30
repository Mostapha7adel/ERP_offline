import { AppError } from "../../core/errors/app-error.js";
import { stockTransferRepository } from "./stock-transfer.repository.js";
import { stockTransferCreateSchema, stockTransferUpdateSchema, type StockTransferCreateInput, type StockTransferUpdateInput } from "./stock-transfer.schema.js";
import type { StockTransfer } from "./stock-transfer.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";
import { productRepository } from "../products/product.repository.js";
import { stockItemRepository } from "../inventory/inventory.repository.js";
import { stockMovementRepository } from "../inventory/inventory.repository.js";
import { withTransaction } from "../../core/database/transaction.js";

export class StockTransferService {
  async create(input: StockTransferCreateInput, audit: AuditContext): Promise<StockTransfer> {
    const validated = stockTransferCreateSchema.parse(input);
    const principalId = audit.principal?.sub ?? "system";

    if (validated.fromWarehouseId === validated.toWarehouseId) {
      throw AppError.badRequest("Source and destination warehouses must differ");
    }
    if (!(await warehouseRepository.findById(validated.fromWarehouseId))) {
      throw AppError.badRequest("Source warehouse not found");
    }
    if (!(await warehouseRepository.findById(validated.toWarehouseId))) {
      throw AppError.badRequest("Destination warehouse not found");
    }

    for (const line of validated.lines) {
      if (!(await productRepository.findById(line.productId))) {
        throw AppError.badRequest(`Product "${line.productId}" not found`);
      }
    }

    const transfer = await stockTransferRepository.create({
      data: {
        fromWarehouseId: validated.fromWarehouseId,
        toWarehouseId: validated.toWarehouseId,
        status: "DRAFT",
        date: validated.date,
        reference: validated.reference,
        notes: validated.notes,
        createdBy: principalId,
      } as any,
    });

    // Create lines via raw prisma
    const { getDb } = await import("../../core/database/prisma.js");
    const db = getDb();
    for (const line of validated.lines) {
      await (db as any).stockTransferLine.create({
        data: {
          transferId: transfer.id,
          productId: line.productId,
          quantity: line.quantity,
        },
      });
    }

    void auditService.log(audit, "create:stock-transfer", "stock-transfer", transfer.id, {
      fromWarehouseId: validated.fromWarehouseId,
      toWarehouseId: validated.toWarehouseId,
    });

    return this.getById(transfer.id);
  }

  async update(id: string, input: StockTransferUpdateInput, audit: AuditContext): Promise<StockTransfer> {
    const existing = await stockTransferRepository.findById(id);
    if (!existing) throw AppError.notFound("Stock transfer not found");
    if (existing.status !== "DRAFT") throw AppError.badRequest("Only DRAFT transfers can be edited");

    const validated = stockTransferUpdateSchema.parse(input);

    await stockTransferRepository.update({
      id,
      data: {
        date: validated.date,
        reference: validated.reference,
        notes: validated.notes,
      } as any,
    });

    // Replace lines if provided
    if (validated.lines) {
      const { getDb } = await import("../../core/database/prisma.js");
      const db = getDb();
      await (db as any).stockTransferLine.deleteMany({ where: { transferId: id } });
      for (const line of validated.lines) {
        await (db as any).stockTransferLine.create({
          data: {
            transferId: id,
            productId: line.productId,
            quantity: line.quantity,
          },
        });
      }
    }

    void auditService.log(audit, "update:stock-transfer", "stock-transfer", id);
    return this.getById(id);
  }

  async complete(id: string, audit: AuditContext): Promise<StockTransfer> {
    const existing = await stockTransferRepository.findById(id);
    if (!existing) throw AppError.notFound("Stock transfer not found");
    if (existing.status !== "DRAFT") throw AppError.badRequest("Only DRAFT transfers can be completed");
    if (existing.lines.length === 0) throw AppError.badRequest("Transfer has no lines");

    const principalId = audit.principal?.sub ?? "system";

    await withTransaction(async () => {
      for (const line of existing.lines) {
        // Decrease stock at source warehouse
        const sourceItem = await stockItemRepository.ensure(line.productId, existing.fromWarehouseId);
        if (sourceItem.quantityOnHand < line.quantity) {
          throw AppError.badRequest(`Insufficient stock for product "${line.productId}" at source warehouse`);
        }
        await stockItemRepository.update({
          id: sourceItem.id,
          data: { quantityOnHand: sourceItem.quantityOnHand - line.quantity },
        });

        // Increase stock at destination warehouse
        const destItem = await stockItemRepository.ensure(line.productId, existing.toWarehouseId);
        await stockItemRepository.update({
          id: destItem.id,
          data: { quantityOnHand: destItem.quantityOnHand + line.quantity },
        });

        // Record stock movements
        await stockMovementRepository.create({
          data: {
            productId: line.productId,
            warehouseId: existing.fromWarehouseId,
            type: "transfer-out" as any,
            quantity: -line.quantity,
            reference: "stock-transfer",
            referenceId: id,
            cost: 0,
            createdBy: principalId,
          },
        });

        await stockMovementRepository.create({
          data: {
            productId: line.productId,
            warehouseId: existing.toWarehouseId,
            type: "transfer-in" as any,
            quantity: line.quantity,
            reference: "stock-transfer",
            referenceId: id,
            cost: 0,
            createdBy: principalId,
          },
        });
      }

      await stockTransferRepository.update({
        id,
        data: { status: "COMPLETED" },
      });
    });

    void auditService.log(audit, "complete:stock-transfer", "stock-transfer", id);
    return this.getById(id);
  }

  async cancel(id: string, audit: AuditContext): Promise<StockTransfer> {
    const existing = await stockTransferRepository.findById(id);
    if (!existing) throw AppError.notFound("Stock transfer not found");
    if (existing.status !== "DRAFT") throw AppError.badRequest("Only DRAFT transfers can be cancelled");

    await stockTransferRepository.update({
      id,
      data: { status: "CANCELLED" },
    });

    void auditService.log(audit, "cancel:stock-transfer", "stock-transfer", id);
    return this.getById(id);
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await stockTransferRepository.findById(id);
    if (!existing) throw AppError.notFound("Stock transfer not found");
    if (existing.status !== "DRAFT") throw AppError.badRequest("Only DRAFT transfers can be deleted");

    // Delete lines first
    const { getDb } = await import("../../core/database/prisma.js");
    const db = getDb();
    await (db as any).stockTransferLine.deleteMany({ where: { transferId: id } });

    await stockTransferRepository.delete(id);
    void auditService.log(audit, "delete:stock-transfer", "stock-transfer", id);
    return { id };
  }

  async getById(id: string): Promise<StockTransfer> {
    const transfer = await stockTransferRepository.findById(id);
    if (!transfer) throw AppError.notFound("Stock transfer not found");
    return transfer;
  }

  async list(options: { page?: number; limit?: number; search?: string } = {}) {
    return stockTransferRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["reference", "notes"],
    });
  }
}

export const stockTransferService = new StockTransferService();
