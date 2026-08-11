import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { warehouseRepository } from "./warehouse.repository.js";
import { warehouseCreateSchema, warehouseUpdateSchema, } from "./warehouse.schema.js";
async function nextCode() {
    return `WH-${String((await warehouseRepository.count()) + 1).padStart(3, "0")}`;
}
export class WarehouseService extends CrudService {
    constructor() {
        super({
            repository: warehouseRepository,
            resourceName: "warehouse",
            createSchema: warehouseCreateSchema,
            updateSchema: warehouseUpdateSchema,
            searchFields: ["code", "name", "address", "manager", "phone"],
            toEntity: async (input, existing) => {
                return {
                    code: input.code?.toUpperCase() ?? existing?.code ?? (await nextCode()),
                    name: input.name ?? existing?.name ?? "",
                    address: input.address ?? existing?.address,
                    manager: input.manager ?? existing?.manager,
                    phone: input.phone ?? existing?.phone,
                    isDefault: input.isDefault ?? existing?.isDefault ?? false,
                    status: input.status ?? existing?.status ?? "active",
                };
            },
        });
    }
    async create(input, audit) {
        const code = (input.code ?? (await nextCode())).toUpperCase();
        if (await warehouseRepository.findByCode(code)) {
            throw AppError.conflict(`Warehouse code "${code}" already exists`);
        }
        if (input.isDefault)
            await this.clearDefault();
        return super.create({ ...input, code }, audit);
    }
    async update(id, input, audit) {
        const existing = await warehouseRepository.findById(id);
        if (!existing)
            throw AppError.notFound("warehouse not found");
        if (input.code) {
            const code = input.code.toUpperCase();
            const clash = await warehouseRepository.findByCode(code);
            if (clash && clash.id !== id) {
                throw AppError.conflict(`Warehouse code "${code}" already exists`);
            }
            input = { ...input, code };
        }
        if (input.isDefault)
            await this.clearDefault();
        return super.update(id, input, audit);
    }
    async clearDefault() {
        for (const w of await warehouseRepository.findAll()) {
            if (w.isDefault)
                await warehouseRepository.update({ id: w.id, data: { isDefault: false } });
        }
    }
}
export const warehouseService = new WarehouseService();
