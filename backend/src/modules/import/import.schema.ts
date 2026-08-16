import { z } from "zod";

export const importProductRowSchema = z.object({
  sku: z.string().min(1, "sku is required"),
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string().default("pcs"),
  purchasePrice: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
  trackStock: z.boolean().default(false),
  reorderLevel: z.number().nonnegative().optional(),
  barcode: z.string().optional(),
});

export const importPartyRowSchema = z.object({
  type: z.enum(["customer", "supplier"]).default("customer"),
  name: z.string().min(1, "name is required"),
  code: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  taxNumber: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
  currency: z.string().max(3).default("EGP"),
});

export const importProductsSchema = z.object({
  rows: z.array(importProductRowSchema).min(1, "At least one row is required"),
  /** When true, existing products (by sku) are updated instead of skipped. */
  updateExisting: z.boolean().default(true),
});

export const importPartiesSchema = z.object({
  rows: z.array(importPartyRowSchema).min(1, "At least one row is required"),
  updateExisting: z.boolean().default(true),
});

export const importResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  errors: z.array(z.object({ row: z.number(), message: z.string() })),
});

export type ImportProductRow = z.infer<typeof importProductRowSchema>;
export type ImportPartyRow = z.infer<typeof importPartyRowSchema>;