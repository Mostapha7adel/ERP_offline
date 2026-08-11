import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { Warehouse } from "./warehouse.entity.js";

type Row = Record<string, unknown>;

export class WarehouseRepository extends PrismaRepository<Warehouse> {
  protected model = "warehouse";
  protected searchFields = ["code", "name", "address", "manager"];

  protected toEntity(row: Row): Warehouse {
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      address: row.address ? String(row.address) : undefined,
      manager: row.manager ? String(row.manager) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      isDefault: Boolean(row.isDefault),
      status: row.status as Warehouse["status"],
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByCode(code: string): Promise<Warehouse | undefined> {
    const all = await this.findAll();
    return all.find((w) => w.code.toLowerCase() === code.toLowerCase());
  }
}

export const warehouseRepository = new WarehouseRepository();
