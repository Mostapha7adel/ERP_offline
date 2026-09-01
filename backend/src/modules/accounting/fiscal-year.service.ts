import { AppError } from "../../core/errors/app-error.js";
import { fiscalYearRepository } from "./fiscal-year.repository.js";
import { accountRepository, journalEntryRepository } from "./accounting.repository.js";
import { fiscalYearCreateSchema, type FiscalYearCreateInput } from "./fiscal-year.schema.js";
import type { FiscalYear } from "./fiscal-year.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { runInTransaction } from "../../core/database/prisma.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Code of the retained earnings account used by the year-end closing entry. */
export const RETAINED_EARNINGS_CODE = "3100";

interface AccountBalance {
  code: string;
  name: string;
  type: string;
  balance: number;
}

export class FiscalYearService {
  /** Balances per account over a date range, from opening balance + posted journals. */
  async balancesForRange(from: string, to: string): Promise<AccountBalance[]> {
    const accounts = await accountRepository.findAll();
    const entries = await journalEntryRepository.byDateRange(from, to);
    const result: AccountBalance[] = accounts.map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      balance: a.openingBalance,
    }));
    for (const entry of entries) {
      for (const line of entry.lines) {
        const row = result.find((r) => r.code === line.accountCode);
        if (!row) continue;
        if (row.type === "asset" || row.type === "expense") {
          row.balance = round2(row.balance + line.debit - line.credit);
        } else {
          row.balance = round2(row.balance + line.credit - line.debit);
        }
      }
    }
    return result;
  }

  /** Ensure a retained earnings account exists under equity; create when missing. */
  private async ensureRetainedEarningsAccount(audit: AuditContext): Promise<void> {
    const existing = await accountRepository.findByCode(RETAINED_EARNINGS_CODE);
    if (existing) return;
    await accountRepository.create({
      data: {
        code: RETAINED_EARNINGS_CODE,
        name: "Retained Earnings",
        type: "equity",
        category: "Equity",
        isActive: true,
        openingBalance: 0,
      },
    });
    void auditService.log(audit, "create:account", "accounting", RETAINED_EARNINGS_CODE, { code: RETAINED_EARNINGS_CODE });
  }

  async list() {
    const years = await fiscalYearRepository.findAll();
    const withBalances = [];
    for (const fy of years) {
      const balances = await this.balancesForRange(fy.startDate, fy.endDate);
      const revenue = round2(balances.filter((b) => b.type === "revenue").reduce((s, b) => s + b.balance, 0));
      const expenses = round2(balances.filter((b) => b.type === "expense").reduce((s, b) => s + b.balance, 0));
      withBalances.push({ ...fy, revenue, expenses, netProfit: round2(revenue - expenses) });
    }
    return withBalances.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  async create(input: FiscalYearCreateInput, audit: AuditContext): Promise<FiscalYear> {
    const validated = fiscalYearCreateSchema.parse(input);
    if (validated.startDate >= validated.endDate) {
      throw AppError.badRequest("Start date must be before the end date");
    }
    const overlap = (await fiscalYearRepository.findAll()).find(
      (f) => f.startDate <= validated.endDate && validated.startDate <= f.endDate,
    );
    if (overlap) {
      throw AppError.conflict(`Fiscal year overlaps with "${overlap.name}" (${overlap.startDate.slice(0, 10)} — ${overlap.endDate.slice(0, 10)})`);
    }
    const year = await fiscalYearRepository.create({
      data: {
        name: validated.name,
        startDate: validated.startDate,
        endDate: validated.endDate,
        status: "open",
        notes: validated.notes,
      },
    });
    void auditService.log(audit, "create:fiscal-year", "accounting", year.id, { name: year.name });
    return year;
  }

  /** Close a fiscal year: zero out revenue/expense accounts into retained earnings. */
  async close(id: string, audit: AuditContext): Promise<FiscalYear> {
    const fy = await fiscalYearRepository.findById(id);
    if (!fy) throw AppError.notFound("Fiscal year not found");
    if (fy.status === "closed") throw AppError.conflict("Fiscal year is already closed");

    return runInTransaction(async () => {
      await this.ensureRetainedEarningsAccount(audit);
      const balances = await this.balancesForRange(fy.startDate, fy.endDate);

      const lines: Array<{ accountCode: string; description?: string; debit: number; credit: number }> = [];
      for (const b of balances) {
        if (b.type === "revenue" && b.balance > 0) {
          lines.push({ accountCode: b.code, description: "Close revenue", debit: round2(b.balance), credit: 0 });
        }
        if (b.type === "expense" && b.balance > 0) {
          lines.push({ accountCode: b.code, description: "Close expense", debit: 0, credit: round2(b.balance) });
        }
      }

      const revenue = round2(balances.filter((b) => b.type === "revenue").reduce((s, b) => s + b.balance, 0));
      const expenses = round2(balances.filter((b) => b.type === "expense").reduce((s, b) => s + b.balance, 0));
      const net = round2(revenue - expenses);
      if (net !== 0) {
        if (net > 0) {
          lines.push({ accountCode: RETAINED_EARNINGS_CODE, description: "Net profit to retained earnings", debit: 0, credit: net });
        } else {
          lines.push({ accountCode: RETAINED_EARNINGS_CODE, description: "Net loss from retained earnings", debit: Math.abs(net), credit: 0 });
        }
      }

      let closingJournalId: string | undefined;
      if (lines.length > 0) {
        const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
        const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          throw AppError.conflict("Closing journal does not balance");
        }
        const journal = await journalEntryRepository.create({
          data: {
            number: await journalEntryRepository.nextNumber(),
            date: fy.endDate,
            memo: `Fiscal year closing — ${fy.name}`,
            status: "posted",
            lines,
            totalDebit,
            totalCredit,
            createdBy: audit.principal?.sub ?? "system",
          },
        });
        closingJournalId = journal.id;
        void auditService.log(audit, "create:journal-entry", "accounting", journal.id, { number: journal.number });
      }

      const updated = await fiscalYearRepository.update({
        id,
        data: {
          status: "closed",
          closingJournalId,
          closedAt: new Date().toISOString(),
          closedBy: audit.principal?.sub ?? "system",
        },
      });
      void auditService.log(audit, "close:fiscal-year", "accounting", id, { name: fy.name, net });
      return (updated as FiscalYear) ?? fy;
    });
  }
}

export const fiscalYearService = new FiscalYearService();
