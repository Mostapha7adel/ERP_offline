import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
export class PartyRepository extends PrismaRepository {
    model = "party";
    searchFields = ["name", "code", "email", "phone", "taxNumber", "city", "contactName"];
    get delegate() {
        return getDb().party;
    }
    toEntity(row) {
        return {
            id: String(row.id),
            type: row.type,
            code: String(row.code),
            name: String(row.name),
            contactName: row.contactName ? String(row.contactName) : undefined,
            email: row.email ? String(row.email) : undefined,
            phone: row.phone ? String(row.phone) : undefined,
            address: row.address ? String(row.address) : undefined,
            city: row.city ? String(row.city) : undefined,
            taxNumber: row.taxNumber ? String(row.taxNumber) : undefined,
            creditLimit: row.creditLimit != null ? Number(row.creditLimit) : undefined,
            currency: String(row.currency),
            notes: row.notes ? String(row.notes) : undefined,
            status: row.status,
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async findByCode(code, type) {
        const parties = await this.findAll();
        return parties.find((p) => p.type === type && p.code.toLowerCase() === code.toLowerCase());
    }
}
export const partyRepository = new PartyRepository();
