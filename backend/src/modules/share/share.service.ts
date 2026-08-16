import { AppError } from "../../core/errors/app-error.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { companyService } from "../settings/company.service.js";
import type { ShareRequestInput } from "./share.types.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

function escapeUri(text: string): string {
  return encodeURIComponent(text);
}

export class ShareService {
  /** Build email + WhatsApp payloads for an invoice or a party statement. */
  async build(input: ShareRequestInput) {
    const company = await companyService.getCompany();
    const companyName = company.name ?? "LedgerFlow";
    const baseCurrency = company.currency ?? "EGP";

    if (input.type === "invoice") {
      if (!input.id) throw AppError.badRequest("An invoice id is required");
      const invoice = await invoiceRepository.findById(input.id);
      if (!invoice) throw AppError.notFound("invoice not found");
      const party = invoice.type === "sales"
        ? (invoice.customerId ? await partyRepository.findById(invoice.customerId) : undefined)
        : (invoice.supplierId ? await partyRepository.findById(invoice.supplierId) : undefined);
      const currency = invoice.currency || party?.currency || baseCurrency;

      const linesText = invoice.lines
        .map((l) => `• ${l.productName} x ${l.quantity} @ ${l.unitPrice} = ${round2(l.lineTotal)}`)
        .join("\n");
      const body = [
        `${companyName}`,
        `Invoice ${invoice.number}`,
        `Date: ${invoice.invoiceDate.slice(0, 10)}`,
        ...(invoice.dueDate ? [`Due: ${invoice.dueDate.slice(0, 10)}`] : []),
        ``,
        `Lines:`,
        linesText,
        ``,
        `Subtotal: ${invoice.subtotal} ${currency}`,
        `Discount: ${invoice.discount} ${currency}`,
        `Tax: ${invoice.tax} ${currency}`,
        `Total: ${invoice.total} ${currency}`,
        `Paid: ${invoice.paidAmount} ${currency}`,
        `Balance: ${round2(invoice.total - invoice.paidAmount)} ${currency}`,
        ``,
        `Thank you,`,
        `${companyName}`,
      ].join("\n");
      const subject = `Invoice ${invoice.number} from ${companyName}`;
      const to = input.to || party?.email || "";
      const phone = party?.phone?.replace(/\D/g, "") || "";
      return this.payload(subject, body, to, phone);
    }

    // Statement for a party
    if (!input.partyId) throw AppError.badRequest("A party id is required for a statement");
    const party = await partyRepository.findById(input.partyId);
    if (!party) throw AppError.notFound("party not found");
    const { statementService } = await import("../reports/statement.service.js");
    const statement = await statementService.forParty(input.partyId);
    const rowsText = statement.rows
      .map((r) => `• ${r.date.slice(0, 10)} ${r.description ?? r.ref}  ${r.debit} / ${r.credit}`)
      .join("\n");
    const body = [
      `${companyName}`,
      `Statement for ${party.name}`,
      ``,
      rowsText,
      ``,
      `Opening: ${statement.opening} ${party.currency}`,
      `Closing: ${statement.closing} ${party.currency}`,
      ``,
      `Thank you,`,
      `${companyName}`,
    ].join("\n");
    const subject = `Account statement for ${party.name}`;
    const to = input.to || party.email || "";
    const phone = party.phone?.replace(/\D/g, "") || "";
    return this.payload(subject, body, to, phone);
  }

  private payload(subject: string, body: string, to: string, phone: string) {
    const mailto = `mailto:${to}?subject=${escapeUri(subject)}&body=${escapeUri(body)}`;
    const waPhone = phone.startsWith("00") ? phone.slice(2) : phone;
    const whatsapp = waPhone
      ? `https://wa.me/${waPhone}?text=${escapeUri(`${subject}\n\n${body}`)}`
      : "";
    return { subject, body, mailto, whatsapp };
  }
}

export const shareService = new ShareService();