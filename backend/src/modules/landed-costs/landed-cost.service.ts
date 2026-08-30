import { AppError } from "../../core/errors/app-error.js";
import { landedCostRepository } from "./landed-cost.repository.js";
import { landedCostCreateSchema, landedCostUpdateSchema, type LandedCostCreateInput, type LandedCostUpdateInput } from "./landed-cost.schema.js";
import type { LandedCost } from "./landed-cost.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { productRepository } from "../products/product.repository.js";
import { stockItemRepository } from "../inventory/inventory.repository.js";
import { withTransaction } from "../../core/database/transaction.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export class LandedCostService {
  async create(input: LandedCostCreateInput, audit: AuditContext): Promise<LandedCost> {
    const validated = landedCostCreateSchema.parse(input);
    const principalId = audit.principal?.sub ?? "system";

    if (validated.purchaseInvoiceId) {
      const invoice = await invoiceRepository.findById(validated.purchaseInvoiceId);
      if (!invoice) throw AppError.badRequest("Purchase invoice not found");
      if (invoice.type !== "purchase") throw AppError.badRequest("Invoice must be a purchase invoice");
    }

    return withTransaction(async () => {
      const landedCost = await landedCostRepository.create({
        data: {
          purchaseInvoiceId: validated.purchaseInvoiceId,
          description: validated.description,
          amount: validated.amount,
          allocationMethod: validated.allocationMethod,
          date: validated.date,
          createdBy: principalId,
        },
      });

      if (validated.purchaseInvoiceId) {
        await this.allocateToInvoice(validated.purchaseInvoiceId, validated.amount, validated.allocationMethod);
      }

      void auditService.log(audit, "create:landed-cost", "landed-cost", landedCost.id, {
        invoiceId: validated.purchaseInvoiceId,
        amount: validated.amount,
      });

      return landedCost;
    });
  }

  async update(id: string, input: LandedCostUpdateInput, audit: AuditContext): Promise<LandedCost> {
    const existing = await landedCostRepository.findById(id);
    if (!existing) throw AppError.notFound("Landed cost not found");
    const validated = landedCostUpdateSchema.parse(input);

    const updated = await landedCostRepository.update({
      id,
      data: {
        description: validated.description,
        amount: validated.amount,
        allocationMethod: validated.allocationMethod,
        date: validated.date,
      },
    });

    void auditService.log(audit, "update:landed-cost", "landed-cost", id);
    return updated as LandedCost;
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await landedCostRepository.findById(id);
    if (!existing) throw AppError.notFound("Landed cost not found");
    await landedCostRepository.delete(id);
    void auditService.log(audit, "delete:landed-cost", "landed-cost", id);
    return { id };
  }

  async getById(id: string): Promise<LandedCost> {
    const landedCost = await landedCostRepository.findById(id);
    if (!landedCost) throw AppError.notFound("Landed cost not found");
    return landedCost;
  }

  async list(options: { page?: number; limit?: number; search?: string } = {}) {
    return landedCostRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["description"],
    });
  }

  private async allocateToInvoice(invoiceId: string, totalAmount: number, method: string): Promise<void> {
    const invoice = await invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.lines.length === 0) return;

    let totalWeight = 0;
    if (method === "weight") {
      for (const line of invoice.lines) {
        if (line.productId) {
          const product = await productRepository.findById(line.productId);
          totalWeight += line.quantity;
        } else {
          totalWeight += line.quantity;
        }
      }
    }

    for (const line of invoice.lines) {
      let share = 0;
      if (method === "value") {
        const totalValue = invoice.lines.reduce((s, l) => s + l.lineTotal, 0);
        share = totalValue > 0 ? (line.lineTotal / totalValue) * totalAmount : 0;
      } else if (method === "quantity") {
        const totalQty = invoice.lines.reduce((s, l) => s + l.quantity, 0);
        share = totalQty > 0 ? (line.quantity / totalQty) * totalAmount : 0;
      } else if (method === "weight") {
        share = totalWeight > 0 ? (line.quantity / totalWeight) * totalAmount : 0;
      }

      if (line.productId && share > 0) {
        await this.adjustProductCost(line.productId, share, line.quantity);
      }
    }
  }

  private async adjustProductCost(productId: string, additionalCost: number, quantity: number): Promise<void> {
    const product = await productRepository.findById(productId);
    if (!product) return;

    const costPerUnit = round2(additionalCost / Math.max(1, quantity));
    const newPurchasePrice = round2(product.purchasePrice + costPerUnit);

    await productRepository.update({
      id: productId,
      data: { purchasePrice: newPurchasePrice },
    });

    const stockItems = await stockItemRepository.findByProduct(productId);
    for (const item of stockItems) {
      if (item.quantityOnHand > 0) {
        const totalValue = round2(item.quantityOnHand * item.averageCost + additionalCost * (item.quantityOnHand / Math.max(1, quantity)));
        const newAvg = round2(totalValue / item.quantityOnHand);
        await stockItemRepository.update({
          id: item.id,
          data: { averageCost: newAvg },
        });
      }
    }
  }
}

export const landedCostService = new LandedCostService();
