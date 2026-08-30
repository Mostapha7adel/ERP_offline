import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { LandedCost } from "./landed-cost.entity.js";

type Row = Record<string, unknown>;

export class LandedCostRepository extends PrismaRepository<LandedCost> {
  protected model = "landedCost";
  protected dateFields = ["date"];
  protected searchFields = ["description"];

  protected toEntity(row: Row): LandedCost {
    return {
      id: String(row.id),
      purchaseInvoiceId: row.purchaseInvoiceId ? String(row.purchaseInvoiceId) : undefined,
      description: String(row.description),
      amount: Number(row.amount),
      allocationMethod: (row.allocationMethod ?? "value") as LandedCost["allocationMethod"],
      date: this.toISO(row.date)!,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async byInvoice(invoiceId: string): Promise<LandedCost[]> {
    const all = await this.findAll();
    return all.filter((c) => c.purchaseInvoiceId === invoiceId);
  }
}

export const landedCostRepository = new LandedCostRepository();
