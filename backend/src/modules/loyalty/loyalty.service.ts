import { AppError } from "../../core/errors/app-error.js";
import { loyaltyAccountRepository, loyaltyTransactionRepository } from "./loyalty.repository.js";
import { loyaltyEarnSchema, loyaltyRedeemSchema, loyaltyAdjustSchema, type LoyaltyEarnInput, type LoyaltyRedeemInput, type LoyaltyAdjustInput } from "./loyalty.schema.js";
import type { LoyaltyAccount, LoyaltyTransaction } from "./loyalty.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { withTransaction } from "../../core/database/transaction.js";

export class LoyaltyService {
  async getAccount(partyId: string): Promise<LoyaltyAccount> {
    const account = await loyaltyAccountRepository.findByParty(partyId);
    if (!account) throw AppError.notFound("Loyalty account not found for this party");
    return account;
  }

  async getOrCreateAccount(partyId: string): Promise<LoyaltyAccount> {
    const existing = await loyaltyAccountRepository.findByParty(partyId);
    if (existing) return existing;
    return loyaltyAccountRepository.create({
      data: {
        partyId,
        points: 0,
        totalEarned: 0,
        totalRedeemed: 0,
      },
    });
  }

  async listAccounts(options: { page?: number; limit?: number; search?: string } = {}) {
    return loyaltyAccountRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["partyId"],
    });
  }

  async listTransactions(options: { page?: number; limit?: number; search?: string } = {}) {
    return loyaltyTransactionRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["description", "invoiceId"],
    });
  }

  async getTransactionsByAccount(accountId: string): Promise<LoyaltyTransaction[]> {
    return loyaltyTransactionRepository.byAccount(accountId);
  }

  async earn(input: LoyaltyEarnInput, audit: AuditContext): Promise<{ account: LoyaltyAccount; transaction: LoyaltyTransaction }> {
    const validated = loyaltyEarnSchema.parse(input);
    const principalId = audit.principal?.sub ?? "system";

    return withTransaction(async () => {
      const account = await this.getOrCreateAccount(validated.partyId);

      const transaction = await loyaltyTransactionRepository.create({
        data: {
          accountId: account.id,
          type: "earn",
          points: validated.points,
          invoiceId: validated.invoiceId,
          description: validated.description ?? "Points earned",
          createdBy: principalId,
        },
      });

      const updated = await loyaltyAccountRepository.update({
        id: account.id,
        data: {
          points: account.points + validated.points,
          totalEarned: account.totalEarned + validated.points,
        },
      });

      void auditService.log(audit, "earn:loyalty", "loyalty", account.id, {
        points: validated.points,
        partyId: validated.partyId,
      });

      return { account: updated as LoyaltyAccount, transaction };
    });
  }

  async redeem(input: LoyaltyRedeemInput, audit: AuditContext): Promise<{ account: LoyaltyAccount; transaction: LoyaltyTransaction }> {
    const validated = loyaltyRedeemSchema.parse(input);
    const principalId = audit.principal?.sub ?? "system";

    const account = await this.getAccount(validated.partyId);
    if (account.points < validated.points) {
      throw AppError.badRequest(`Insufficient points. Available: ${account.points}, requested: ${validated.points}`);
    }

    return withTransaction(async () => {
      const transaction = await loyaltyTransactionRepository.create({
        data: {
          accountId: account.id,
          type: "redeem",
          points: validated.points,
          invoiceId: validated.invoiceId,
          description: validated.description ?? "Points redeemed",
          createdBy: principalId,
        },
      });

      const updated = await loyaltyAccountRepository.update({
        id: account.id,
        data: {
          points: account.points - validated.points,
          totalRedeemed: account.totalRedeemed + validated.points,
        },
      });

      void auditService.log(audit, "redeem:loyalty", "loyalty", account.id, {
        points: validated.points,
        partyId: validated.partyId,
      });

      return { account: updated as LoyaltyAccount, transaction };
    });
  }

  async adjust(input: LoyaltyAdjustInput, audit: AuditContext): Promise<{ account: LoyaltyAccount; transaction: LoyaltyTransaction }> {
    const validated = loyaltyAdjustSchema.parse(input);
    const principalId = audit.principal?.sub ?? "system";

    const account = await this.getOrCreateAccount(validated.partyId);
    const newBalance = account.points + validated.points;
    if (newBalance < 0) {
      throw AppError.badRequest(`Adjustment would result in negative balance. Current: ${account.points}, adjustment: ${validated.points}`);
    }

    return withTransaction(async () => {
      const transaction = await loyaltyTransactionRepository.create({
        data: {
          accountId: account.id,
          type: "adjust",
          points: validated.points,
          description: validated.description ?? "Manual adjustment",
          createdBy: principalId,
        },
      });

      const updated = await loyaltyAccountRepository.update({
        id: account.id,
        data: { points: newBalance },
      });

      void auditService.log(audit, "adjust:loyalty", "loyalty", account.id, {
        points: validated.points,
        partyId: validated.partyId,
      });

      return { account: updated as LoyaltyAccount, transaction };
    });
  }

  async deleteAccount(id: string, audit: AuditContext): Promise<{ id: string }> {
    const account = await loyaltyAccountRepository.findById(id);
    if (!account) throw AppError.notFound("Loyalty account not found");
    await loyaltyAccountRepository.delete(id);
    void auditService.log(audit, "delete:loyalty", "loyalty", id);
    return { id };
  }
}

export const loyaltyService = new LoyaltyService();
