import { z } from "zod";

export const noteLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export const noteCreateSchema = z.object({
  type: z.enum(["sales", "purchase"]),
  noteType: z.enum(["credit", "debit"]),
  /** Optional invoice this note adjusts. Its type must match `type`. */
  invoiceId: z.string().optional(),
  /** Party (customer for sales / supplier for purchase). Derived from the invoice when linked. */
  partyId: z.string().optional(),
  warehouseId: z.string().optional(),
  noteDate: z.string(),
  lines: z.array(noteLineSchema).min(1, "At least one line is required"),
  discount: z.number().nonnegative().default(0),
  reason: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

export const noteSchema = z.object({
  id: z.string(),
  type: z.enum(["sales", "purchase"]),
  noteType: z.enum(["credit", "debit"]),
  number: z.string(),
  invoiceId: z.string().optional(),
  partyId: z.string().optional(),
  warehouseId: z.string().optional(),
  noteDate: z.string(),
  lines: z.array(noteLineSchema.extend({ id: z.string(), lineTotal: z.number() })),
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

export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
