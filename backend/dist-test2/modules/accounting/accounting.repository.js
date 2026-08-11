import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
export class AccountRepository extends PrismaRepository {
    model = "account";
    searchFields = ["code", "name", "category"];
    include = { parent: true };
    toEntity(row) {
        const parent = row.parent;
        return {
            id: String(row.id),
            code: String(row.code),
            name: String(row.name),
            type: row.type,
            category: String(row.category),
            isActive: Boolean(row.isActive),
            openingBalance: Number(row.openingBalance),
            parentCode: parent?.code,
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    async resolveParentId(parentCode) {
        if (!parentCode)
            return null;
        const parent = await getDb().account.findFirst({ where: { code: parentCode, deletedAt: null } });
        return parent?.id ?? null;
    }
    async create(input) {
        const now = input.now ?? new Date().toISOString();
        const companyId = await getDefaultCompanyId();
        const { parentCode, ...rest } = input.data;
        const parentId = await this.resolveParentId(parentCode);
        const row = await this.delegate.create({
            data: {
                ...rest,
                parentId,
                companyId,
                id: crypto.randomUUID(),
                createdAt: new Date(now),
                updatedAt: new Date(now),
            },
            include: this.include,
        });
        return this.toEntity(row);
    }
    async update(input) {
        const existing = await this.delegate.findFirst({
            where: { ...this.baseWhere(), id: input.id },
        });
        if (!existing)
            return undefined;
        const now = input.now ?? new Date().toISOString();
        const { parentCode, ...rest } = input.data;
        const data = { ...rest, updatedAt: new Date(now) };
        if (parentCode !== undefined)
            data.parentId = await this.resolveParentId(parentCode);
        const row = await this.delegate.update({
            where: { id: input.id },
            data,
            include: this.include,
        });
        return this.toEntity(row);
    }
    async findByCode(code) {
        const rows = await this.delegate.findFirst({
            where: { ...this.baseWhere(), code },
            include: this.include,
        });
        return rows ? this.toEntity(rows) : undefined;
    }
    async byType(type) {
        const all = await this.findAll();
        return all.filter((a) => a.type === type);
    }
}
export class JournalEntryRepository extends PrismaRepository {
    model = "journalEntry";
    dateFields = ["date"];
    searchFields = ["number", "memo"];
    include = { lines: { include: { account: true } } };
    toEntity(row) {
        const rawLines = row.lines ?? [];
        return {
            id: String(row.id),
            number: String(row.number),
            date: this.toISO(row.date),
            memo: row.memo ? String(row.memo) : undefined,
            status: row.status,
            lines: rawLines.map((l) => this.toLine(l)),
            totalDebit: Number(row.totalDebit),
            totalCredit: Number(row.totalCredit),
            createdBy: String(row.createdBy),
            createdAt: this.toISO(row.createdAt),
            updatedAt: this.toISO(row.updatedAt),
        };
    }
    toLine(l) {
        const account = l.account;
        return {
            accountCode: account?.code ?? String(l.accountId ?? ""),
            description: l.description ? String(l.description) : undefined,
            debit: Number(l.debit),
            credit: Number(l.credit),
        };
    }
    async resolveAccountId(accountCode) {
        const account = await getDb().account.findFirst({ where: { code: accountCode, deletedAt: null } });
        if (!account) {
            throw new Error(`Account code "${accountCode}" does not exist`);
        }
        return account.id;
    }
    async create(input) {
        const now = input.now ?? new Date().toISOString();
        const companyId = await getDefaultCompanyId();
        const { lines, ...rest } = input.data;
        const details = await Promise.all((lines ?? []).map(async (l) => ({
            accountId: await this.resolveAccountId(l.accountCode),
            description: l.description ?? null,
            debit: l.debit,
            credit: l.credit,
        })));
        const row = await this.delegate.create({
            data: {
                ...rest,
                date: this.toDate(rest.date) ?? new Date(now),
                companyId,
                id: crypto.randomUUID(),
                createdAt: new Date(now),
                updatedAt: new Date(now),
                lines: { create: details },
            },
            include: this.include,
        });
        return this.toEntity(row);
    }
    async nextNumber() {
        const count = await this.delegate.count({ where: this.baseWhere() });
        return `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    }
    async byAccount(code) {
        const all = await this.findAll();
        return all.filter((j) => j.status === "posted" && j.lines.some((l) => l.accountCode === code));
    }
}
export const accountRepository = new AccountRepository();
export const journalEntryRepository = new JournalEntryRepository();
