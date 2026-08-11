import { PrismaRepository } from "../../core/repository/base-repository.js";
export class WarehouseRepository extends PrismaRepository {
    model = "warehouse";
    searchFields = ["code", "name", "address", "manager"];
    toEntity(row) {
        return {
            id: String(row.id),
            code: String(row.code),
            name: String(row.name),
            address: row.address ? String(row.address) : undefined,
            manager: row.manager ? String(row.manager) : undefined,
            phone: row.phone ? String(row.phone) : undefined,
            isDefault: Boolean(row.isDefault),
            status: row.status,
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async findByCode(code) {
        const all = await this.findAll();
        return all.find((w) => w.code.toLowerCase() === code.toLowerCase());
    }
}
export const warehouseRepository = new WarehouseRepository();
