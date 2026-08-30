import { z } from "zod";

export const landedCostCreateSchema = z.object({
  purchaseInvoiceId: z.string().optional(),
  description: z.string().min(1, "Description is required").max(500),
  amount: z.number().positive("Amount must be positive"),
  allocationMethod: z.enum(["value", "quantity", "weight"]).default("value"),
  date: z.string().min(1, "Date is required"),
});

export const landedCostUpdateSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  amount: z.number().positive("Amount must be positive").optional(),
  allocationMethod: z.enum(["value", "quantity", "weight"]).optional(),
  date: z.string().optional(),
});

export const landedCostSchema = z.object({
  id: z.string(),
  purchaseInvoiceId: z.string().optional(),
  description: z.string(),
  amount: z.number(),
  allocationMethod: z.enum(["value", "quantity", "weight"]),
  date: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LandedCostCreateInput = z.infer<typeof landedCostCreateSchema>;
export type LandedCostUpdateInput = z.infer<typeof landedCostUpdateSchema>;
