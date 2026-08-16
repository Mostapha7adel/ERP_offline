import { z } from "zod";

export const poLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export const poCreateSchema = z.object({
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  orderDate: z.string(),
  expectedDate: z.string().optional(),
  lines: z.array(poLineSchema).min(1, "At least one line is required"),
  discount: z.number().nonnegative().default(0),
  currency: z.string().max(3).default("EGP"),
  notes: z.string().max(2000).optional(),
});

export const poUpdateSchema = z.object({
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  lines: z.array(poLineSchema).optional(),
  discount: z.number().nonnegative().optional(),
  currency: z.string().max(3).optional(),
  notes: z.string().max(2000).optional(),
});

export const poLineOutSchema = poLineSchema.extend({
  id: z.string(),
  purchaseOrderId: z.string(),
  receivedQty: z.number(),
  lineTotal: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const poSchema = z.object({
  id: z.string(),
  number: z.string(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  orderDate: z.string(),
  expectedDate: z.string().optional(),
  status: z.enum(["draft", "pending", "approved", "partially_received", "received", "cancelled"]),
  subtotal: z.number(),
  discount: z.number(),
  tax: z.number(),
  total: z.number(),
  currency: z.string(),
  notes: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PurchaseOrderCreateInput = z.infer<typeof poCreateSchema>;
export type PurchaseOrderUpdateInput = z.infer<typeof poUpdateSchema>;