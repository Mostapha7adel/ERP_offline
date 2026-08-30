import { z } from "zod";

export const salesReturnLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export const salesReturnCreateSchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  returnDate: z.string(),
  lines: z.array(salesReturnLineSchema).min(1, "At least one line is required"),
  discount: z.number().nonnegative().default(0),
  reason: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

export const salesReturnUpdateSchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  returnDate: z.string().optional(),
  lines: z.array(salesReturnLineSchema).optional(),
  discount: z.number().nonnegative().optional(),
  reason: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

export const salesReturnSchema = z.object({
  id: z.string(),
  number: z.string(),
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  returnDate: z.string(),
  lines: z.array(salesReturnLineSchema.extend({ id: z.string(), lineTotal: z.number() })),
  subtotal: z.number(),
  discount: z.number(),
  tax: z.number(),
  total: z.number(),
  status: z.enum(["issued", "void"]),
  reason: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SalesReturnCreateInput = z.infer<typeof salesReturnCreateSchema>;
export type SalesReturnUpdateInput = z.infer<typeof salesReturnUpdateSchema>;
