import { z } from "zod";

export const productCreateSchema = z.object({
  sku: z.string().min(1).max(50).optional(),
  barcode: z.string().max(50).optional(),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(["product", "service"]).default("product"),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  unit: z.string().max(20).default("pcs"),
  purchasePrice: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  trackStock: z.boolean().default(true),
  reorderLevel: z.number().int().nonnegative().optional(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  barcode: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(["product", "service"]),
  category: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string(),
  purchasePrice: z.number(),
  salePrice: z.number(),
  taxRate: z.number(),
  imageUrl: z.string().optional(),
  trackStock: z.boolean(),
  reorderLevel: z.number().optional(),
  status: z.enum(["active", "draft", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
