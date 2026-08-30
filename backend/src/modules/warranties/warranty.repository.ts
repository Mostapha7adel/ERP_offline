import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Warranty } from "./warranty.entity.js";

type Row = Record<string, unknown>;

export class WarrantyRepository extends PrismaRepository<Warranty> {
  protected model = "warranty";
  protected dateFields = ["startDate", "endDate"];
  protected searchFields = ["warrantyNumber", "notes"];

  protected toEntity(row: Row): Warranty {
    return {
      id: String(row.id),
      productId: String(row.productId),
      serialNumberId: row.serialNumberId ? String(row.serialNumberId) : undefined,
      customerId: String(row.customerId),
      warrantyNumber: String(row.warrantyNumber),
      startDate: this.toISO(row.startDate)!,
      endDate: this.toISO(row.endDate)!,
      status: row.status as Warranty["status"],
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByCustomer(customerId: string): Promise<Warranty[]> {
    const all = await this.findAll();
    return all.filter((w) => w.customerId === customerId);
  }

  async findByProduct(productId: string): Promise<Warranty[]> {
    const all = await this.findAll();
    return all.filter((w) => w.productId === productId);
  }

  async findByStatus(status: string): Promise<Warranty[]> {
    const all = await this.findAll();
    return all.filter((w) => w.status === status);
  }

  async findByInvoice(invoiceId: string): Promise<Warranty[]> {
    const all = await this.findAll();
    return all.filter((w) => w.invoiceId === invoiceId);
  }
}

export const warrantyRepository = new WarrantyRepository();
