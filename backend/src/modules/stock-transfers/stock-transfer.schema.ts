import { z } from "zod";

const stockTransferLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive("Quantity must be positive"),
});

export const stockTransferCreateSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  date: z.string().min(1),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(stockTransferLineSchema).min(1, "At least one line is required"),
});

export const stockTransferUpdateSchema = z.object({
  date: z.string().optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(stockTransferLineSchema).optional(),
});

export const stockTransferSchema = z.object({
  id: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  status: z.enum(["DRAFT", "COMPLETED", "CANCELLED"]),
  date: z.string(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lines: z.array(z.object({
    transferId: z.string(),
    productId: z.string(),
    quantity: z.number(),
  })),
});

export type StockTransferCreateInput = z.infer<typeof stockTransferCreateSchema>;
export type StockTransferUpdateInput = z.infer<typeof stockTransferUpdateSchema>;
