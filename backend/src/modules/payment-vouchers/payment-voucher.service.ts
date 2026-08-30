import { AppError } from "../../core/errors/app-error.js";
import { paymentVoucherRepository } from "./payment-voucher.repository.js";
import {
  paymentVoucherCreateSchema,
  paymentVoucherUpdateSchema,
  type PaymentVoucherCreateInput,
  type PaymentVoucherUpdateInput,
} from "./payment-voucher.schema.js";
import type { PaymentVoucher } from "./payment-voucher.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { treasuryAccountRepository } from "../treasury/treasury.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { withTransaction } from "../../core/database/transaction.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

export class PaymentVoucherService {
  async create(input: PaymentVoucherCreateInput, audit: AuditContext): Promise<PaymentVoucher> {
    const validated = paymentVoucherCreateSchema.parse(input);

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";

      // Resolve party if provided
      if (validated.partyId) {
        const party = await partyRepository.findById(validated.partyId);
        if (!party) throw AppError.badRequest("Party not found");
      }

      // Resolve account if provided
      if (validated.accountId) {
        const account = await treasuryAccountRepository.findById(validated.accountId);
        if (!account) throw AppError.badRequest("Treasury account not found");
        if (!account.isActive) throw AppError.badRequest(`Account "${account.name}" is inactive`);
      }

      const number = await paymentVoucherRepository.nextNumber(validated.type);

      const voucher = await paymentVoucherRepository.create({
        data: {
          number,
          type: validated.type,
          status: "active",
          partyId: validated.partyId,
          partyType: validated.partyType,
          invoiceId: validated.invoiceId,
          accountId: validated.accountId,
          amount: validated.amount,
          method: validated.method,
          reference: validated.reference,
          voucherDate: validated.voucherDate,
          notes: validated.notes,
          createdBy: principalId,
        },
      });

      // Update invoice paidAmount if linked
      if (validated.invoiceId) {
        const invoice = await invoiceRepository.findById(validated.invoiceId);
        if (invoice && invoice.status !== "void") {
          const paidAmount = round2(invoice.paidAmount + validated.amount);
          const total = invoice.total;
          const status = paidAmount >= total ? "paid" : paidAmount > 0 ? "partial" : invoice.status;
          await invoiceRepository.update({ id: invoice.id, data: { paidAmount, status } });
        }
      }

      // Update treasury account balance if linked
      if (validated.accountId) {
        const account = await treasuryAccountRepository.findById(validated.accountId);
        if (account) {
          const delta = validated.type === "receipt" ? validated.amount : -validated.amount;
          const newBalance = round2(account.balance + delta);
          if (validated.type === "payment" && newBalance < 0) {
            throw AppError.badRequest("Insufficient balance in the selected account");
          }
          await treasuryAccountRepository.update({
            id: account.id,
            data: { balance: newBalance },
          });
        }
      }

      await auditService.log(audit, `create:payment-voucher-${validated.type}`, "payment-voucher", voucher.id, { number, amount: validated.amount });
      await notificationService.create({
        kind: "success",
        title: validated.type === "receipt" ? "Receipt voucher created" : "Payment voucher created",
        message: `${voucher.number} — ${validated.amount}`,
        resource: "payment-voucher",
        resourceId: voucher.id,
        actor: audit.principal,
      });

      return voucher;
    });
  }

  async update(id: string, input: PaymentVoucherUpdateInput, audit: AuditContext): Promise<PaymentVoucher> {
    const existing = await paymentVoucherRepository.findById(id);
    if (!existing) throw AppError.notFound("Payment voucher not found");
    const validated = paymentVoucherUpdateSchema.parse(input);

    return withTransaction(async () => {
      const updated = await paymentVoucherRepository.update({
        id,
        data: {
          partyId: validated.partyId,
          partyType: validated.partyType,
          invoiceId: validated.invoiceId,
          accountId: validated.accountId,
          amount: validated.amount,
          method: validated.method,
          reference: validated.reference,
          voucherDate: validated.voucherDate,
          notes: validated.notes,
        },
      });

      await auditService.log(audit, "update:payment-voucher", "payment-voucher", id);
      return updated as PaymentVoucher;
    });
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await paymentVoucherRepository.findById(id);
    if (!existing) throw AppError.notFound("Payment voucher not found");

    return withTransaction(async () => {
      // Reverse invoice paidAmount
      if (existing.invoiceId) {
        const invoice = await invoiceRepository.findById(existing.invoiceId);
        if (invoice && invoice.status !== "void") {
          const paidAmount = Math.max(0, round2(invoice.paidAmount - existing.amount));
          const status = paidAmount >= invoice.total ? "paid" : paidAmount > 0 ? "partial" : "issued";
          await invoiceRepository.update({ id: invoice.id, data: { paidAmount, status } });
        }
      }

      // Reverse treasury account balance
      if (existing.accountId) {
        const account = await treasuryAccountRepository.findById(existing.accountId);
        if (account) {
          const delta = existing.type === "receipt" ? -existing.amount : existing.amount;
          await treasuryAccountRepository.update({
            id: account.id,
            data: { balance: round2(account.balance + delta) },
          });
        }
      }

      await paymentVoucherRepository.delete(id);
      await auditService.log(audit, "delete:payment-voucher", "payment-voucher", id, { number: existing.number });
      return { id };
    });
  }

  async void(id: string, audit: AuditContext): Promise<PaymentVoucher> {
    const existing = await paymentVoucherRepository.findById(id);
    if (!existing) throw AppError.notFound("Payment voucher not found");

    return withTransaction(async () => {
      // Reverse invoice paidAmount if linked
      if (existing.invoiceId) {
        const invoice = await invoiceRepository.findById(existing.invoiceId);
        if (invoice && invoice.status !== "void") {
          const paidAmount = Math.max(0, round2(invoice.paidAmount - existing.amount));
          const status = paidAmount >= invoice.total ? "paid" : paidAmount > 0 ? "partial" : "issued";
          await invoiceRepository.update({ id: invoice.id, data: { paidAmount, status } });
        }
      }

      // Reverse treasury account balance if linked
      if (existing.accountId) {
        const account = await treasuryAccountRepository.findById(existing.accountId);
        if (account) {
          const delta = existing.type === "receipt" ? -existing.amount : existing.amount;
          await treasuryAccountRepository.update({
            id: account.id,
            data: { balance: round2(account.balance + delta) },
          });
        }
      }

      const updated = await paymentVoucherRepository.update({
        id,
        data: { status: "void" } as any,
      });

      await auditService.log(audit, "void:payment-voucher", "payment-voucher", id, { number: existing.number });
      return updated as PaymentVoucher;
    });
  }

  async getById(id: string): Promise<PaymentVoucher> {
    const voucher = await paymentVoucherRepository.findById(id);
    if (!voucher) throw AppError.notFound("Payment voucher not found");
    return voucher;
  }

  async list(options: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
  } = {}) {
    return paymentVoucherRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["number", "reference", "notes"],
      filters: options.type ? { type: [options.type] } : undefined,
    });
  }

  async enrich(voucher: PaymentVoucher) {
    const party = voucher.partyId ? await partyRepository.findById(voucher.partyId) : undefined;
    const invoice = voucher.invoiceId ? await invoiceRepository.findById(voucher.invoiceId) : undefined;
    const account = voucher.accountId ? await treasuryAccountRepository.findById(voucher.accountId) : undefined;
    return {
      ...voucher,
      partyName: party?.name,
      invoiceNumber: invoice?.number,
      accountName: account?.name,
    };
  }
}

export const paymentVoucherService = new PaymentVoucherService();
