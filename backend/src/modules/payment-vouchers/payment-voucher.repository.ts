import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { PaymentVoucher } from "./payment-voucher.entity.js";

type Row = Record<string, unknown>;

export class PaymentVoucherRepository extends PrismaRepository<PaymentVoucher> {
  protected model = "paymentVoucher";
  protected dateFields = ["voucherDate"];
  protected searchFields = ["number", "reference", "notes"];

  protected toEntity(row: Row): PaymentVoucher {
    return {
      id: String(row.id),
      number: String(row.number),
      type: row.type as PaymentVoucher["type"],
      partyId: row.partyId ? String(row.partyId) : undefined,
      partyType: row.partyType ? (row.partyType as PaymentVoucher["partyType"]) : undefined,
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      accountId: row.accountId ? String(row.accountId) : undefined,
      amount: Number(row.amount),
      method: String(row.method ?? "cash"),
      reference: row.reference ? String(row.reference) : undefined,
      voucherDate: this.toISO(row.voucherDate)!,
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByNumber(number: string): Promise<PaymentVoucher | undefined> {
    const row = await this.delegate.findFirst({
      where: { ...this.baseWhere(), number },
    });
    return row ? this.toEntity(row as Row) : undefined;
  }

  async nextNumber(type: PaymentVoucher["type"]): Promise<string> {
    const prefix = type === "receipt" ? "RV" : "PV";
    const count = await this.delegate.count({ where: { ...this.baseWhere(), type } });
    return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }

  async byInvoiceId(invoiceId: string): Promise<PaymentVoucher[]> {
    const all = await this.findAll();
    return all.filter((v) => v.invoiceId === invoiceId);
  }
}

export const paymentVoucherRepository = new PaymentVoucherRepository();
