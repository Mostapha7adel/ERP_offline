import { AppError } from "../../core/errors/app-error.js";
import { accountRepository, journalEntryRepository } from "./accounting.repository.js";
import { fiscalYearRepository } from "./fiscal-year.repository.js";
import {
  accountCreateSchema,
  accountUpdateSchema,
  journalCreateSchema,
  type AccountCreateInput,
  type AccountUpdateInput,
  type JournalCreateInput,
} from "./accounting.schema.js";
import type { Account, JournalEntry } from "./accounting.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export class AccountingService {
  // ---- Chart of accounts ----

  async createAccount(input: AccountCreateInput, audit: AuditContext): Promise<Account> {
    const validated = accountCreateSchema.parse(input);
    if (await accountRepository.findByCode(validated.code)) {
      throw AppError.conflict(`Account code "${validated.code}" already exists`);
    }
    const account = await accountRepository.create({ data: validated });
    void auditService.log(audit, "create:account", "accounting", account.id, { code: account.code });
    return account;
  }

  async updateAccount(id: string, input: AccountUpdateInput, audit: AuditContext): Promise<Account> {
    const existing = await accountRepository.findById(id);
    if (!existing) throw AppError.notFound("account not found");
    if (input.code) {
      const clash = await accountRepository.findByCode(input.code);
      if (clash && clash.id !== id) throw AppError.conflict(`Account code "${input.code}" already exists`);
    }
    const updated = await accountRepository.update({ id, data: { ...existing, ...input } });
    void auditService.log(audit, "update:account", "accounting", id);
    return updated as Account;
  }

  async deleteAccount(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await accountRepository.findById(id);
    if (!existing) throw AppError.notFound("account not found");
    if ((await journalEntryRepository.byAccount(existing.code)).length > 0) {
      throw AppError.conflict("Cannot delete an account referenced by journal entries");
    }
    await accountRepository.delete(id);
    void auditService.log(audit, "delete:account", "accounting", id);
    return { id };
  }

  async listAccounts(options: { page?: number; limit?: number; search?: string; type?: string } = {}) {
    const result = await accountRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["code", "name", "category"],
      filters: options.type ? { type: [options.type] } : undefined,
      sortBy: "code",
      sortDir: "asc",
    });
    return result;
  }

  async getChart() {
    const accounts = await accountRepository.findAll();
    const balances: Record<string, number> = {};
    for (const account of accounts) {
      const entries = await journalEntryRepository.byAccount(account.code);
      let net = account.openingBalance;
      for (const entry of entries) {
        for (const line of entry.lines) {
          if (line.accountCode !== account.code) continue;
          if (account.type === "asset" || account.type === "expense") {
            net += line.debit - line.credit;
          } else {
            net += line.credit - line.debit;
          }
        }
      }
      balances[account.code] = round2(net);
    }
    return accounts.map((a) => ({ ...a, balance: balances[a.code] }));
  }

  // ---- Journal entries (double-entry) ----

  async createJournal(input: JournalCreateInput, audit: AuditContext): Promise<JournalEntry> {
    const validated = journalCreateSchema.parse(input);

    // Reject dates inside a closed fiscal year (the period is locked).
    const closed = await fiscalYearRepository.findClosedContaining(validated.date);
    if (closed) {
      throw AppError.conflict(
        `Journal date ${validated.date.slice(0, 10)} falls within the closed fiscal year "${closed.name}". Reopen the year or use another date.`,
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of validated.lines) {
      if (!(await accountRepository.findByCode(line.accountCode))) {
        throw AppError.badRequest(`Account code "${line.accountCode}" does not exist`);
      }
      if (line.debit > 0 && line.credit > 0) {
        throw AppError.badRequest("A line cannot be both debit and credit");
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }
    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);
    if (totalDebit !== totalCredit) {
      throw AppError.badRequest("Journal entry must be balanced (debits must equal credits)");
    }
    if (totalDebit === 0) {
      throw AppError.badRequest("Journal entry cannot be empty");
    }

    const entry = await journalEntryRepository.create({
      data: {
        number: await journalEntryRepository.nextNumber(),
        date: validated.date,
        memo: validated.memo,
        status: "posted",
        lines: validated.lines,
        totalDebit,
        totalCredit,
        createdBy: audit.principal?.sub ?? "system",
      },
    });
    void auditService.log(audit, "create:journal-entry", "accounting", entry.id, { number: entry.number });
    return entry;
  }

  async voidJournal(id: string, audit: AuditContext): Promise<JournalEntry> {
    const entry = await journalEntryRepository.findById(id);
    if (!entry) throw AppError.notFound("journal entry not found");
    if (entry.status === "void") return entry;
    const updated = await journalEntryRepository.update({ id, data: { status: "void" } });
    void auditService.log(audit, "void:journal-entry", "accounting", id);
    return updated as JournalEntry;
  }

  async listJournals(options: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const result = await journalEntryRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["number", "memo"],
      filters: options.status ? { status: [options.status] } : undefined,
      sortBy: "date",
      sortDir: "desc",
    });
    return result;
  }

  async getJournal(id: string): Promise<JournalEntry> {
    const entry = await journalEntryRepository.findById(id);
    if (!entry) throw AppError.notFound("journal entry not found");
    return entry;
  }

  async getLedger(accountCode: string) {
    const account = await accountRepository.findByCode(accountCode);
    if (!account) throw AppError.notFound(`Account "${accountCode}" not found`);
    const entries = (await journalEntryRepository.byAccount(accountCode)).sort((a, b) => a.date.localeCompare(b.date));
    let running = account.openingBalance;
    const rows = entries.map((entry) => {
      const line = entry.lines.find((l) => l.accountCode === accountCode);
      const debit = line?.debit ?? 0;
      const credit = line?.credit ?? 0;
      running = round2(running + (account.type === "asset" || account.type === "expense" ? debit - credit : credit - debit));
      return {
        journalId: entry.id,
        number: entry.number,
        date: entry.date,
        memo: entry.memo,
        debit,
        credit,
        runningBalance: running,
      };
    });
    return { account, entries: rows };
  }

  async getTrialBalance(fiscalYearId?: string) {
    let chart = await this.getChart();

    // When a fiscal year is selected, scope balances to journals dated inside
    // that year (opening balances carry forward).
    if (fiscalYearId) {
      const fy = await fiscalYearRepository.findById(fiscalYearId);
      if (!fy) throw AppError.notFound("Fiscal year not found");
      const balances = await this.balancesForRange(fy.startDate, fy.endDate);
      chart = chart.map((a) => {
        const balance = balances[a.code];
        return balance !== undefined ? { ...a, balance } : a;
      });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const rows = chart.map((account) => {
      if (account.type === "asset" || account.type === "expense") {
        totalDebit += account.balance;
        return { code: account.code, name: account.name, type: account.type, debit: account.balance, credit: 0 };
      }
      totalCredit += account.balance;
      return { code: account.code, name: account.name, type: account.type, debit: 0, credit: account.balance };
    });
    return {
      rows,
      totalDebit: round2(totalDebit),
      totalCredit: round2(totalCredit),
      fiscalYearId,
    };
  }

  /** Balances per account over a date range (opening balance + posted journals). */
  private async balancesForRange(from: string, to: string) {
    const accounts = await accountRepository.findAll();
    const entries = await journalEntryRepository.byDateRange(from, to);
    const balances: Record<string, number> = {};
    for (const account of accounts) {
      balances[account.code] = account.openingBalance;
    }
    for (const entry of entries) {
      for (const line of entry.lines) {
        const account = accounts.find((a) => a.code === line.accountCode);
        if (!account) continue;
        const delta = account.type === "asset" || account.type === "expense"
          ? line.debit - line.credit
          : line.credit - line.debit;
        balances[line.accountCode] = round2((balances[line.accountCode] ?? 0) + delta);
      }
    }
    return balances;
  }
}

export const accountingService = new AccountingService();
