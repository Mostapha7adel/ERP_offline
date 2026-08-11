import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { partyRepository } from "./party.repository.js";
import { partyCreateSchema, partyUpdateSchema } from "./party.schema.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
async function makeCode(type) {
    const prefix = type === "customer" ? "CUS" : "SUP";
    const count = (await partyRepository.findAll()).filter((p) => p.type === type).length + 1;
    return `${prefix}-${String(count).padStart(4, "0")}`;
}
export class PartyService extends CrudService {
    partyType;
    constructor(partyType) {
        super({
            repository: partyRepository,
            resourceName: partyType,
            createSchema: partyCreateSchema,
            updateSchema: partyUpdateSchema,
            searchFields: ["name", "code", "email", "phone", "taxNumber", "city", "contactName"],
            toEntity: async (input, existing) => {
                return {
                    type: this.partyType,
                    code: input.code?.toUpperCase() ?? existing?.code ?? (await makeCode(this.partyType)),
                    name: input.name ?? existing?.name ?? "",
                    contactName: input.contactName ?? existing?.contactName,
                    email: input.email ? input.email : existing?.email,
                    phone: input.phone ?? existing?.phone,
                    address: input.address ?? existing?.address,
                    city: input.city ?? existing?.city,
                    taxNumber: input.taxNumber ?? existing?.taxNumber,
                    creditLimit: input.creditLimit ?? existing?.creditLimit,
                    currency: input.currency ?? existing?.currency ?? "USD",
                    notes: input.notes ?? existing?.notes,
                    status: input.status ?? existing?.status ?? "active",
                };
            },
            beforeDelete: async (id) => {
                const party = await partyRepository.findById(id);
                if (!party)
                    return;
                if (await hasTransactions(party.type, id)) {
                    throw AppError.conflict(`Cannot delete ${party.type} with linked transactions`);
                }
            },
        });
        this.partyType = partyType;
    }
    async list(options) {
        const result = await partyRepository.list({
            ...options,
            searchFields: this.searchFields,
            filters: { ...(options.filters ?? {}), type: [this.partyType] },
        });
        return result;
    }
    async create(input, audit) {
        const normalized = { ...input, type: this.partyType };
        const code = (normalized.code ?? (await makeCode(this.partyType))).toUpperCase();
        if (await partyRepository.findByCode(code, this.partyType)) {
            throw AppError.conflict(`${this.partyType} code "${code}" already exists`);
        }
        normalized.code = code;
        return super.create(normalized, audit);
    }
    async update(id, input, audit) {
        const existing = await partyRepository.findById(id);
        if (!existing)
            throw AppError.notFound(`${this.partyType} not found`);
        if (input.code) {
            const code = input.code.toUpperCase();
            const clash = await partyRepository.findByCode(code, this.partyType);
            if (clash && clash.id !== id) {
                throw AppError.conflict(`${this.partyType} code "${code}" already exists`);
            }
            input = { ...input, code };
        }
        return super.update(id, input, audit);
    }
}
async function hasTransactions(type, partyId) {
    return (await invoiceRepository.findAll()).some((inv) => (type === "customer" ? inv.customerId : inv.supplierId) === partyId);
}
export function createPartyService(type) {
    return new PartyService(type);
}
