import { z } from "zod";

export const paymentVoucherCreateSchema = z.object({
  type: z.enum(["receipt", "payment"]),
  partyId: z.string().optional(),
  partyType: z.enum(["customer", "supplier"]).optional(),
  invoiceId: z.string().optional(),
  accountId: z.string().optional(),
  amount: z.number().positive("Amount must be greater than zero"),
  method: z.string().default("cash"),
  reference: z.string().max(100).optional(),
  voucherDate: z.string(),
  notes: z.string().max(2000).optional(),
});

export const paymentVoucherUpdateSchema = z.object({
  partyId: z.string().optional(),
  partyType: z.enum(["customer", "supplier"]).optional(),
  invoiceId: z.string().optional(),
  accountId: z.string().optional(),
  amount: z.number().positive().optional(),
  method: z.string().optional(),
  reference: z.string().max(100).optional(),
  voucherDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const paymentVoucherSchema = z.object({
  id: z.string(),
  number: z.string(),
  type: z.enum(["receipt", "payment"]),
  partyId: z.string().optional(),
  partyType: z.enum(["customer", "supplier"]).optional(),
  invoiceId: z.string().optional(),
  accountId: z.string().optional(),
  amount: z.number(),
  method: z.string(),
  reference: z.string().optional(),
  voucherDate: z.string(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PaymentVoucherCreateInput = z.infer<typeof paymentVoucherCreateSchema>;
export type PaymentVoucherUpdateInput = z.infer<typeof paymentVoucherUpdateSchema>;
