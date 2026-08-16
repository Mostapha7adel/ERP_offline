import { AppError } from "../../core/errors/app-error.js";
import { customerAdvanceRepository, advanceAllocationRepository } from "./advance.repository.js";
import {
  advanceCreateSchema,
  advanceUpdateSchema,
  advanceAllocateSchema,
  type AdvanceCreateInput,
  type AdvanceUpdateInput,
  type AdvanceAllocateInput,
} from "./advance.schema.js";
import type { CustomerAdvance } from "./advance.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { partyRepository } from "../parties/party.repository.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { withTransaction } from "../../core/database/transaction.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export class AdvanceService {
  async create(input: AdvanceCreateInput, audit: AuditContext): Promise<CustomerAdvance> {
    const validated = advanceCreateSchema.parse(input);
    const party = await partyRepository.findById(validated.partyId);
    if (!party) throw AppError.badRequest("Customer not found");
    if (party.type !== "customer") throw AppError.badRequest("Advances can only be recorded for customers");

    return withTransaction(async () => {
      const advance = await customerAdvanceRepository.create({
        data: {
          partyId: party.id,
          amount: validated.amount,
          balance: validated.amount,
          currency: party.currency ?? validated.currency,
          date: validated.date,
          method: validated.method,
          reference: validated.reference,
          notes: validated.notes,
          createdBy: audit.principal?.sub ?? "system",
        },
      });
      void auditService.log(audit, "create:advance", "treasury", advance.id, { amount: advance.amount });
      await notificationService.create({
        kind: "success",
        title: "Customer advance recorded",
        message: `${party.name} — ${advance.amount} ${advance.currency}`,
        resource: "advance",
        resourceId: advance.id,
        actor: audit.principal,
      });
      return advance;
    });
  }

  async update(id: string, input: AdvanceUpdateInput, audit: AuditContext): Promise<CustomerAdvance> {
    const existing = await customerAdvanceRepository.findById(id);
    if (!existing) throw AppError.notFound("advance not found");
    const validated = advanceUpdateSchema.parse(input);
    const used = existing.amount - existing.balance;
    const amount = validated.amount ?? existing.amount;
    if (amount < used) throw AppError.badRequest("Amount cannot be less than the allocated portion");
    const updated = await customerAdvanceRepository.update({
      id,
      data: {
        amount,
        balance: round2(amount - used),
        date: validated.date,
        method: validated.method,
        reference: validated.reference,
        notes: validated.notes,
      },
    });
    void auditService.log(audit, "update:advance", "treasury", id);
    return updated as CustomerAdvance;
  }

  /**
   * Allocate part of an advance against a sales invoice: reduce the advance
   * balance and the invoice's paid amount (treasury transaction + balance).
   */
  async allocate(advanceId: string, input: AdvanceAllocateInput, audit: AuditContext): Promise<CustomerAdvance> {
    const validated = advanceAllocateSchema.parse(input);
    const advance = await customerAdvanceRepository.findById(advanceId);
    if (!advance) throw AppError.notFound("advance not found");
    if (advance.balance <= 0) throw AppError.conflict("Advance is fully allocated");
    if (validated.amount > advance.balance) {
      throw AppError.badRequest(`Allocation exceeds the remaining balance of ${advance.balance}`);
    }

    return withTransaction(async () => {
      const invoice = await invoiceRepository.findById(validated.invoiceId);
      if (!invoice) throw AppError.notFound("invoice not found");
      if (invoice.type !== "sales") throw AppError.badRequest("Advances can only be allocated to sales invoices");
      if (invoice.customerId !== advance.partyId) {
        throw AppError.badRequest("The invoice belongs to a different customer than the advance");
      }
      if (invoice.status === "void") throw AppError.conflict("Cannot allocate to a void invoice");
      const invoiceBalance = round2(invoice.total - invoice.paidAmount);
      if (validated.amount > invoiceBalance + 0.01) {
        throw AppError.badRequest("Allocation exceeds the invoice's remaining balance");
      }

      await advanceAllocationRepository.create({
        data: {
          advanceId: advance.id,
          invoiceId: invoice.id,
          amount: validated.amount,
          appliedAt: new Date().toISOString(),
          createdBy: audit.principal?.sub ?? "system",
        },
      });

      const paidAmount = round2(invoice.paidAmount + validated.amount);
      const status = paidAmount >= invoice.total ? "paid" : "partial";
      await invoiceRepository.update({ id: invoice.id, data: { paidAmount, status } });

      // Record the cash-in treasury transaction against the default account.
      const {
        treasuryTransactionRepository,
        treasuryAccountRepository,
      } = await import("../treasury/treasury.repository.js");
      const account = await treasuryAccountRepository.findByName("Petty Cash")
        ?? await treasuryAccountRepository.findByName("Main Bank Account")
        ?? (await treasuryAccountRepository.findAll())[0];
      if (account) {
        await treasuryTransactionRepository.create({
          data: {
            accountId: account.id,
            type: "income",
            amount: round2(validated.amount),
            category: "customer-payment",
            partyType: "customer",
            partyId: invoice.customerId ?? undefined,
            reference: invoice.number,
            referenceId: invoice.id,
            description: `Advance allocation — ${invoice.number}`,
            date: new Date().toISOString(),
            createdBy: audit.principal?.sub ?? "system",
          },
        });
        await treasuryAccountRepository.update({
          id: account.id,
          data: { balance: round2(account.balance + validated.amount) },
        });
      }

      const updatedAdvance = await customerAdvanceRepository.update({
        id: advance.id,
        data: { balance: round2(advance.balance - validated.amount) },
      });

      void auditService.log(audit, "allocate:advance", "treasury", advance.id, {
        invoiceId: invoice.id,
        amount: validated.amount,
      });
      await notificationService.create({
        kind: "success",
        title: "Advance allocated",
        message: `${validated.amount} applied to ${invoice.number}`,
        resource: "advance",
        resourceId: advance.id,
        actor: audit.principal,
      });
      return updatedAdvance as CustomerAdvance;
    });
  }

  async getById(id: string): Promise<CustomerAdvance> {
    const advance = await customerAdvanceRepository.findById(id);
    if (!advance) throw AppError.notFound("advance not found");
    return advance;
  }

  async list(options: { page?: number; limit?: number; search?: string; partyId?: string } = {}) {
    const result = await customerAdvanceRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["reference", "notes"],
      filters: options.partyId ? { partyId: [options.partyId] } : undefined,
    });
    return result;
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await customerAdvanceRepository.findById(id);
    if (!existing) throw AppError.notFound("advance not found");
    const allocations = await advanceAllocationRepository.byAdvance(id);
    if (allocations.length > 0) throw AppError.conflict("Cannot delete an advance that has been allocated");
    await customerAdvanceRepository.delete(id);
    void auditService.log(audit, "delete:advance", "treasury", id);
    return { id };
  }

  /** Enrich with party name + allocations for the frontend. */
  async enrich(advance: CustomerAdvance) {
    const party = await partyRepository.findById(advance.partyId);
    const allocations = await advanceAllocationRepository.byAdvance(advance.id);
    const withInvoices = await Promise.all(
      allocations.map(async (a) => {
        const invoice = await invoiceRepository.findById(a.invoiceId);
        return { ...a, invoiceNumber: invoice?.number };
      }),
    );
    return {
      ...advance,
      partyName: party?.name,
      allocations: withInvoices,
    };
  }
}

export const advanceService = new AdvanceService();