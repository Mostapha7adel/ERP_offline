import { z } from "zod";

export const priceListCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const priceListUpdateSchema = priceListCreateSchema.partial();

export const priceListSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
});

export const priceListItemCreateSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  price: z.number().min(0, "Price must be non-negative"),
  minQuantity: z.number().min(1, "Minimum quantity must be at least 1").default(1),
});

export const priceListItemSchema = z.object({
  id: z.string(),
  priceListId: z.string(),
  productId: z.string(),
  price: z.number(),
  minQuantity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
});

export type PriceListCreateInput = z.infer<typeof priceListCreateSchema>;
export type PriceListUpdateInput = z.infer<typeof priceListUpdateSchema>;
export type PriceListItemCreateInput = z.infer<typeof priceListItemCreateSchema>;
