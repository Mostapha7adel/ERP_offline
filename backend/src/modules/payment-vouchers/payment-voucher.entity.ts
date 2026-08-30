export type PaymentVoucherType = "receipt" | "payment";
export type PaymentVoucherPartyType = "customer" | "supplier";

export interface PaymentVoucher {
  id: string;
  number: string;
  type: PaymentVoucherType;
  partyId?: string;
  partyType?: PaymentVoucherPartyType;
  invoiceId?: string;
  accountId?: string;
  amount: number;
  method: string;
  reference?: string;
  voucherDate: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
