import { PrismaRepository } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { AppError } from "../../core/errors/app-error.js";
import type { Account, JournalEntry, JournalLine } from "./accounting.entity.js";

type Row = Record<string, unknown>;

export class AccountRepository extends PrismaRepository<Account> {
  protected model = "account";
  protected searchFields = ["code", "name", "category"];
  protected include = { parent: true };

  protected toEntity(row: Row): Account {
    const parent = row.parent as { code?: string } | null;
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      type: row.type as Account["type"],
      category: String(row.category),
      isActive: Boolean(row.isActive),
      openingBalance: Number(row.openingBalance),
      parentCode: parent?.code,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private async resolveParentId(parentCode: string | undefined): Promise<string | null> {
    if (!parentCode) return null;
    const parent = await getDb().account.findFirst({ where: { code: parentCode, deletedAt: null } });
    return parent?.id ?? null;
  }

  override async create(input: { data: Omit<Account, keyof { id: string; createdAt: string; updatedAt: string }>; now?: string }): Promise<Account> {
    const now = input.now ?? new Date().toISOString();
    const companyId = await getDefaultCompanyId();
    const { parentCode, ...rest } = input.data;
    const parentId = await this.resolveParentId(parentCode);
    const row = await this.delegate.create({
      data: {
        ...(rest as Record<string, unknown>),
        parentId,
        companyId,
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      include: this.include,
    });
    return this.toEntity(row as Row);
  }

  override async update(input: { id: string; data: Partial<Omit<Account, keyof { id: string; createdAt: string; updatedAt: string }>>; now?: string }): Promise<Account | undefined> {
    const existing = await this.delegate.findFirst({
      where: { ...this.baseWhere(), id: input.id },
    });
    if (!existing) return undefined;

    const now = input.now ?? new Date().toISOString();
    const { parentCode, ...rest } = input.data;
    const data: Record<string, unknown> = { ...rest, updatedAt: new Date(now) };
    if (parentCode !== undefined) data.parentId = await this.resolveParentId(parentCode);
    const row = await this.delegate.update({
      where: { id: input.id },
      data,
      include: this.include,
    });
    return this.toEntity(row as Row);
  }

  async findByCode(code: string): Promise<Account | undefined> {
    const rows = await this.delegate.findFirst({
      where: { ...this.baseWhere(), code },
      include: this.include,
    });
    return rows ? this.toEntity(rows as Row) : undefined;
  }

  async byType(type: Account["type"]): Promise<Account[]> {
    const all = await this.findAll();
    return all.filter((a) => a.type === type);
  }
}

export class JournalEntryRepository extends PrismaRepository<JournalEntry> {
  protected model = "journalEntry";
  protected dateFields = ["date"];
  protected searchFields = ["number", "memo"];
  protected include = { lines: { include: { account: true } } };

  protected toEntity(row: Row): JournalEntry {
    const rawLines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      id: String(row.id),
      number: String(row.number),
      date: this.toISO(row.date)!,
      memo: row.memo ? String(row.memo) : undefined,
      status: row.status as JournalEntry["status"],
      lines: rawLines.map((l) => this.toLine(l)),
      totalDebit: Number(row.totalDebit),
      totalCredit: Number(row.totalCredit),
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  private toLine(l: Record<string, unknown>): JournalLine {
    const account = l.account as { code?: string } | null;
    return {
      accountCode: account?.code ?? String(l.accountId ?? ""),
      description: l.description ? String(l.description) : undefined,
      debit: Number(l.debit),
      credit: Number(l.credit),
    };
  }

  private async resolveAccountId(accountCode: string): Promise<string> {
    const account = await getDb().account.findFirst({ where: { code: accountCode, deletedAt: null } });
    if (!account) {
      throw AppError.badRequest(`Account code "${accountCode}" does not exist`);
    }
    return account.id;
  }

  override async create(input: { data: Omit<JournalEntry, keyof { id: string; createdAt: string; updatedAt: string }>; now?: string }): Promise<JournalEntry> {
    const now = input.now ?? new Date().toISOString();
    const companyId = await getDefaultCompanyId();
    const { lines, ...rest } = input.data;
    const details = await Promise.all(
      (lines ?? []).map(async (l) => ({
        accountId: await this.resolveAccountId(l.accountCode),
        description: l.description ?? null,
        debit: l.debit,
        credit: l.credit,
      })),
    );
    const row = await this.delegate.create({
      data: {
        ...(rest as Record<string, unknown>),
        date: this.toDate(rest.date as string) ?? new Date(now),
        companyId,
        id: crypto.randomUUID(),
        createdAt: new Date(now),
        updatedAt: new Date(now),
        lines: { create: details },
      },
      include: this.include,
    });
    return this.toEntity(row as Row);
  }

  async nextNumber(): Promise<string> {
    const count = await this.delegate.count({ where: this.baseWhere() });
    return `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }

  async byAccount(code: string): Promise<JournalEntry[]> {
    const all = await this.findAll();
    return all.filter((j) => j.status === "posted" && j.lines.some((l) => l.accountCode === code));
  }

  /** Posted journal entries whose date falls within [from, to] (ISO strings). */
  async byDateRange(from: string, to: string): Promise<JournalEntry[]> {
    const all = await this.findAll();
    return all.filter((j) => j.status === "posted" && j.date >= from && j.date <= to);
  }
}

export const accountRepository = new AccountRepository();
export const journalEntryRepository = new JournalEntryRepository();
