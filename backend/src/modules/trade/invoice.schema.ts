import { z } from "zod";

export const invoiceLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const invoiceCreateSchema = z.object({
  type: z.enum(["sales", "purchase"]),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  warehouseId: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "At least one line is required"),
  discount: z.number().nonnegative().default(0),
  paymentMethod: z.string().optional(),
  /** Pay the full invoice amount at creation (records a treasury transaction). */
  paidNow: z.boolean().optional(),
  /** Treasury account used for the payment when `paidNow` is set. */
  paymentAccountId: z.string().optional(),
  received: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  /** Optional id of the quote this invoice was converted from. */
  quoteId: z.string().optional(),
});

export const invoiceUpdateSchema = z.object({
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  status: z.enum(["draft", "issued", "partial", "paid", "void"]).optional(),
  received: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(invoiceLineSchema).optional(),
  discount: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
});

export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(["issued", "paid", "void"]),
});

export const paymentSchema = z.object({
  amount: z.number().positive("Payment amount must be positive"),
  method: z.string().optional(),
  accountId: z.string().optional(),
});

export const invoiceSchema = z.object({
  id: z.string(),
  type: z.enum(["sales", "purchase"]),
  number: z.string(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  invoiceDate: z.string(),
  dueDate: z.string().optional(),
  warehouseId: z.string().optional(),
  lines: z.array(
    invoiceLineSchema.extend({ id: z.string(), lineTotal: z.number() }),
  ),
  subtotal: z.number(),
  discount: z.number(),
  tax: z.number(),
  total: z.number(),
  paidAmount: z.number(),
  received: z.boolean(),
  status: z.enum(["draft", "issued", "partial", "paid", "void"]),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  quoteId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>;
