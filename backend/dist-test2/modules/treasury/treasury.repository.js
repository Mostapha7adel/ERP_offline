import { PrismaRepository } from "../../core/repository/base-repository.js";
const ACC_TYPE_TO_DB = {
    cash: "cash",
    bank: "bank",
    "credit-card": "creditCard",
    paypal: "paypal",
    other: "other",
};
const ACC_TYPE_FROM_DB = {
    cash: "cash",
    bank: "bank",
    creditCard: "credit-card",
    paypal: "paypal",
    other: "other",
};
export class TreasuryAccountRepository extends PrismaRepository {
    model = "treasuryAccount";
    searchFields = ["name", "notes"];
    toEntity(row) {
        return {
            id: String(row.id),
            name: String(row.name),
            type: (ACC_TYPE_FROM_DB[String(row.type)] ?? String(row.type)),
            currency: String(row.currency),
            openingBalance: Number(row.openingBalance),
            balance: Number(row.balance),
            isActive: Boolean(row.isActive),
            notes: row.notes ? String(row.notes) : undefined,
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    toCreateData(data) {
        return { ...data, type: ACC_TYPE_TO_DB[data.type] ?? data.type };
    }
    toUpdateData(data) {
        return { ...data, type: data.type ? ACC_TYPE_TO_DB[data.type] ?? data.type : undefined };
    }
    async findByName(name) {
        const all = await this.findAll();
        return all.find((a) => a.name.toLowerCase() === name.toLowerCase());
    }
}
export class TreasuryTransactionRepository extends PrismaRepository {
    model = "treasuryTransaction";
    dateFields = ["date"];
    searchFields = ["category", "reference", "description"];
    toEntity(row) {
        return {
            id: String(row.id),
            accountId: String(row.accountId),
            type: row.type,
            amount: Number(row.amount),
            category: String(row.category),
            partyType: row.partyType ? row.partyType : undefined,
            partyId: row.partyId ? String(row.partyId) : undefined,
            reference: row.reference ? String(row.reference) : undefined,
            referenceId: row.referenceId ? String(row.referenceId) : undefined,
            description: row.description ? String(row.description) : undefined,
            date: this.toISO(row.date),
            createdBy: String(row.createdBy),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async byAccount(accountId) {
        const all = await this.findAll();
        return all.filter((t) => t.accountId === accountId);
    }
    async byDateRange(from, to) {
        const all = await this.findAll();
        return all.filter((t) => t.date >= from && t.date <= to);
    }
}
export const treasuryAccountRepository = new TreasuryAccountRepository();
export const treasuryTransactionRepository = new TreasuryTransactionRepository();
