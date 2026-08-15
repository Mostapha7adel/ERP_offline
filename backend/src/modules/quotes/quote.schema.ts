import { z } from "zod";

export const quoteLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export const quoteCreateSchema = z.object({
  type: z.enum(["sales", "purchase"]),
  partyId: z.string().min(1, "Party is required"),
  quoteDate: z.string(),
  validUntil: z.string().optional(),
  warehouseId: z.string().optional(),
  lines: z.array(quoteLineSchema).min(1, "At least one line is required"),
  discount: z.number().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export const quoteUpdateSchema = z.object({
  partyId: z.string().optional(),
  quoteDate: z.string().optional(),
  validUntil: z.string().optional(),
  warehouseId: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]).optional(),
  lines: z.array(quoteLineSchema).optional(),
  discount: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const quoteSchema = z.object({
  id: z.string(),
  type: z.enum(["sales", "purchase"]),
  number: z.string(),
  partyId: z.string().optional(),
  partyName: z.string().optional(),
  quoteDate: z.string(),
  validUntil: z.string().optional(),
  warehouseId: z.string().optional(),
  warehouseName: z.string().optional(),
  lines: z.array(quoteLineSchema.extend({ id: z.string(), lineTotal: z.number() })),
  subtotal: z.number(),
  discount: z.number(),
  tax: z.number(),
  total: z.number(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>;
export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>;
