import { AppError } from "../../core/errors/app-error.js";
import { treasuryAccountRepository, treasuryTransactionRepository } from "./treasury.repository.js";
import { accountCreateSchema, transactionCreateSchema, transferSchema, } from "./treasury.schema.js";
import { auditService } from "../../core/audit/audit.service.js";
import { withTransaction } from "../../core/database/transaction.js";
const round2 = (n) => Math.round(n * 100) / 100;
export class TreasuryService {
    async createAccount(input, audit) {
        const validated = accountCreateSchema.parse(input);
        if (await treasuryAccountRepository.findByName(validated.name)) {
            throw AppError.conflict(`Account "${validated.name}" already exists`);
        }
        const account = await treasuryAccountRepository.create({
            data: {
                name: validated.name,
                type: validated.type,
                currency: validated.currency,
                openingBalance: validated.openingBalance,
                balance: validated.openingBalance,
                isActive: validated.isActive,
                notes: validated.notes,
            },
        });
        await auditService.log(audit, "create:treasury-account", "treasury", account.id);
        return account;
    }
    async updateAccount(id, input, audit) {
        const existing = await treasuryAccountRepository.findById(id);
        if (!existing)
            throw AppError.notFound("account not found");
        if (input.name) {
            const clash = await treasuryAccountRepository.findByName(input.name);
            if (clash && clash.id !== id)
                throw AppError.conflict(`Account "${input.name}" already exists`);
        }
        const updated = await treasuryAccountRepository.update({
            id,
            data: {
                name: input.name ?? existing.name,
                type: input.type ?? existing.type,
                currency: input.currency ?? existing.currency,
                notes: input.notes ?? existing.notes,
                isActive: input.isActive ?? existing.isActive,
            },
        });
        await auditService.log(audit, "update:treasury-account", "treasury", id);
        return updated;
    }
    async deleteAccount(id, audit) {
        if ((await treasuryTransactionRepository.byAccount(id)).length > 0) {
            throw AppError.conflict("Cannot delete an account with transactions");
        }
        if (!(await treasuryAccountRepository.delete(id)))
            throw AppError.notFound("account not found");
        await auditService.log(audit, "delete:treasury-account", "treasury", id);
        return { id };
    }
    async createTransaction(input, audit) {
        const validated = transactionCreateSchema.parse(input);
        return withTransaction(async () => {
            const account = await treasuryAccountRepository.findById(validated.accountId);
            if (!account)
                throw AppError.badRequest("Account not found");
            const date = validated.date ?? new Date().toISOString();
            const delta = validated.type === "expense" ? -validated.amount : validated.amount;
            await treasuryAccountRepository.update({
                id: account.id,
                data: { balance: round2(account.balance + delta) },
            });
            const txn = await treasuryTransactionRepository.create({
                data: {
                    accountId: validated.accountId,
                    type: validated.type,
                    amount: validated.amount,
                    category: validated.category,
                    partyType: validated.partyType,
                    partyId: validated.partyId,
                    reference: validated.reference,
                    description: validated.description,
                    date,
                    createdBy: audit.principal?.sub ?? "system",
                },
            });
            await auditService.log(audit, `create:treasury-${validated.type}`, "treasury", txn.id);
            return txn;
        });
    }
    async transfer(input, audit) {
        const validated = transferSchema.parse(input);
        if (validated.fromAccountId === validated.toAccountId) {
            throw AppError.badRequest("Source and destination accounts must differ");
        }
        return withTransaction(async () => {
            const from = await treasuryAccountRepository.findById(validated.fromAccountId);
            const to = await treasuryAccountRepository.findById(validated.toAccountId);
            if (!from)
                throw AppError.badRequest("Source account not found");
            if (!to)
                throw AppError.badRequest("Destination account not found");
            if (from.balance < validated.amount)
                throw AppError.badRequest("Insufficient balance in source account");
            const date = validated.date ?? new Date().toISOString();
            await treasuryAccountRepository.update({ id: from.id, data: { balance: round2(from.balance - validated.amount) } });
            await treasuryAccountRepository.update({ id: to.id, data: { balance: round2(to.balance + validated.amount) } });
            for (const accountId of [from.id, to.id]) {
                await treasuryTransactionRepository.create({
                    data: {
                        accountId,
                        type: "transfer",
                        amount: validated.amount,
                        category: "transfer",
                        reference: `${from.name} → ${to.name}`,
                        description: validated.description,
                        date,
                        createdBy: audit.principal?.sub ?? "system",
                    },
                });
            }
            await auditService.log(audit, "transfer-funds", "treasury", from.id, { to: to.id, amount: validated.amount });
            return { success: true };
        });
    }
    async listAccounts(options = {}) {
        const result = await treasuryAccountRepository.list({
            ...options,
            searchFields: ["name", "notes"],
            sortBy: "createdAt",
            sortDir: "asc",
        });
        return result;
    }
    async getAccount(id) {
        const account = await treasuryAccountRepository.findById(id);
        if (!account)
            throw AppError.notFound("account not found");
        return account;
    }
    async listTransactions(options = {}) {
        const all = (await treasuryTransactionRepository.findAll())
            .filter((t) => !options.accountId || t.accountId === options.accountId)
            .filter((t) => !options.type || t.type === options.type);
        const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date));
        const page = options.page ?? 1;
        const limit = options.limit ?? 20;
        const start = (page - 1) * limit;
        return {
            items: sorted.slice(start, start + limit),
            total: sorted.length,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(sorted.length / limit)),
        };
    }
    async getStatement(accountId) {
        const account = await this.getAccount(accountId);
        const txns = (await treasuryTransactionRepository.byAccount(accountId)).sort((a, b) => a.date.localeCompare(b.date));
        let running = account.openingBalance;
        const rows = txns.map((t) => {
            running = round2(running + (t.type === "expense" ? -t.amount : t.amount));
            return { ...t, runningBalance: running };
        });
        return { account, rows };
    }
    async getSummary() {
        const accounts = await treasuryAccountRepository.findAll();
        const totalBalance = round2(accounts.reduce((s, a) => s + a.balance, 0));
        const allTxns = await treasuryTransactionRepository.findAll();
        const income = round2(allTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0));
        const expense = round2(allTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
        return {
            totalBalance,
            income,
            expense,
            net: round2(income - expense),
            accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance, currency: a.currency })),
        };
    }
}
export const treasuryService = new TreasuryService();
export { treasuryAccountRepository, treasuryTransactionRepository };
