import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { TreasuryAccount, TreasuryTransaction } from "./treasury.entity.js";

type Row = Record<string, unknown>;

const ACC_TYPE_TO_DB: Record<string, string> = {
  cash: "cash",
  bank: "bank",
  "credit-card": "creditCard",
  paypal: "paypal",
  other: "other",
};

const ACC_TYPE_FROM_DB: Record<string, string> = {
  cash: "cash",
  bank: "bank",
  creditCard: "credit-card",
  paypal: "paypal",
  other: "other",
};

export class TreasuryAccountRepository extends PrismaRepository<TreasuryAccount> {
  protected model = "treasuryAccount";
  protected searchFields = ["name", "notes"];

  protected toEntity(row: Row): TreasuryAccount {
    return {
      id: String(row.id),
      name: String(row.name),
      type: (ACC_TYPE_FROM_DB[String(row.type)] ?? String(row.type)) as TreasuryAccount["type"],
      currency: String(row.currency),
      openingBalance: Number(row.openingBalance),
      balance: Number(row.balance),
      isActive: Boolean(row.isActive),
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  protected toCreateData(data: Omit<TreasuryAccount, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    return { ...data, type: ACC_TYPE_TO_DB[data.type] ?? data.type };
  }

  protected toUpdateData(data: Partial<Omit<TreasuryAccount, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    return { ...data, type: data.type ? ACC_TYPE_TO_DB[data.type] ?? data.type : undefined };
  }

  async findByName(name: string): Promise<TreasuryAccount | undefined> {
    const all = await this.findAll();
    return all.find((a) => a.name.toLowerCase() === name.toLowerCase());
  }
}

export class TreasuryTransactionRepository extends PrismaRepository<TreasuryTransaction> {
  protected model = "treasuryTransaction";
  protected dateFields = ["date"];
  protected searchFields = ["category", "reference", "description"];

  protected toEntity(row: Row): TreasuryTransaction {
    return {
      id: String(row.id),
      accountId: String(row.accountId),
      type: row.type as TreasuryTransaction["type"],
      amount: Number(row.amount),
      category: String(row.category),
      partyType: row.partyType ? (row.partyType as TreasuryTransaction["partyType"]) : undefined,
      partyId: row.partyId ? String(row.partyId) : undefined,
      reference: row.reference ? String(row.reference) : undefined,
      referenceId: row.referenceId ? String(row.referenceId) : undefined,
      description: row.description ? String(row.description) : undefined,
      date: this.toISO(row.date)!,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      reversed: row.deletedAt ? true : undefined,
    };
  }

  async byAccount(accountId: string): Promise<TreasuryTransaction[]> {
    const all = await this.findAll();
    return all.filter((t) => t.accountId === accountId);
  }

  async byInvoiceId(invoiceId: string): Promise<TreasuryTransaction[]> {
    const all = await this.findAll();
    return all.filter((t) => t.referenceId === invoiceId);
  }

  async deleteByInvoiceId(invoiceId: string): Promise<number> {
    // Soft delete: keep the row so it can be displayed as "reversed" in the ledger.
    const rows = await this.delegate.updateMany({
      where: { referenceId: invoiceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return rows.count;
  }

  async deleteById(id: string): Promise<boolean> {
    const rows = await this.delegate.deleteMany({
      where: { id, deletedAt: null },
    });
    return rows.count > 0;
  }

  /** All transactions including reversed/voided ones (for ledger display). */
  async findAllIncludingReversed(): Promise<TreasuryTransaction[]> {
    const rows = await this.delegate.findMany({});
    return Promise.all(rows.map((row) => this.rowToEntity(row)));
  }

  async byDateRange(from: string, to: string): Promise<TreasuryTransaction[]> {
    const all = await this.findAll();
    return all.filter((t) => t.date >= from && t.date <= to);
  }
}

export const treasuryAccountRepository = new TreasuryAccountRepository();
export const treasuryTransactionRepository = new TreasuryTransactionRepository();
