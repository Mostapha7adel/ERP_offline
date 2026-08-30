import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { LoyaltyAccount, LoyaltyTransaction } from "./loyalty.entity.js";

type Row = Record<string, unknown>;

export class LoyaltyAccountRepository extends PrismaRepository<LoyaltyAccount> {
  protected model = "loyaltyAccount";
  protected searchFields = ["partyId"];

  protected toEntity(row: Row): LoyaltyAccount {
    return {
      id: String(row.id),
      partyId: String(row.partyId),
      points: Number(row.points),
      totalEarned: Number(row.totalEarned),
      totalRedeemed: Number(row.totalRedeemed),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByParty(partyId: string): Promise<LoyaltyAccount | undefined> {
    const all = await this.findAll();
    return all.find((a) => a.partyId === partyId);
  }
}

export class LoyaltyTransactionRepository extends PrismaRepository<LoyaltyTransaction> {
  protected model = "loyaltyTransaction";
  protected searchFields = ["description", "invoiceId"];

  protected toEntity(row: Row): LoyaltyTransaction {
    return {
      id: String(row.id),
      accountId: String(row.accountId),
      type: row.type as LoyaltyTransaction["type"],
      points: Number(row.points),
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      description: row.description ? String(row.description) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async byAccount(accountId: string): Promise<LoyaltyTransaction[]> {
    const all = await this.findAll();
    return all.filter((t) => t.accountId === accountId);
  }

  async byInvoice(invoiceId: string): Promise<LoyaltyTransaction[]> {
    const all = await this.findAll();
    return all.filter((t) => t.invoiceId === invoiceId);
  }
}

export const loyaltyAccountRepository = new LoyaltyAccountRepository();
export const loyaltyTransactionRepository = new LoyaltyTransactionRepository();
