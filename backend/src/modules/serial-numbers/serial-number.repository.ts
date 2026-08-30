import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { SerialNumber } from "./serial-number.entity.js";

type Row = Record<string, unknown>;

export class SerialNumberRepository extends PrismaRepository<SerialNumber> {
  protected model = "serialNumber";
  protected dateFields = [];
  protected searchFields = ["serialNumber"];

  protected toEntity(row: Row): SerialNumber {
    return {
      id: String(row.id),
      productId: String(row.productId),
      serialNumber: String(row.serialNumber),
      status: row.status as SerialNumber["status"],
      warehouseId: String(row.warehouseId),
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findBySerialNumber(companyId: string, serialNumber: string): Promise<SerialNumber | undefined> {
    const rows = await this.delegate.findMany({
      where: { ...this.baseWhere(), companyId, serialNumber },
    });
    if (rows.length === 0) return undefined;
    return this.toEntity(rows[0] as Row);
  }

  async findByProduct(productId: string): Promise<SerialNumber[]> {
    const all = await this.findAll();
    return all.filter((s) => s.productId === productId);
  }

  async findByWarehouse(warehouseId: string): Promise<SerialNumber[]> {
    const all = await this.findAll();
    return all.filter((s) => s.warehouseId === warehouseId);
  }

  async findByStatus(status: string): Promise<SerialNumber[]> {
    const all = await this.findAll();
    return all.filter((s) => s.status === status);
  }

  async findByInvoice(invoiceId: string): Promise<SerialNumber[]> {
    const all = await this.findAll();
    return all.filter((s) => s.invoiceId === invoiceId);
  }
}

export const serialNumberRepository = new SerialNumberRepository();
