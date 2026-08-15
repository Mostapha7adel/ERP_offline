import { z } from "zod";

export const recurringLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

export const recurringCreateSchema = z.object({
  type: z.enum(["sales", "purchase"]),
  partyId: z.string().min(1, "Party is required"),
  warehouseId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  interval: z.number().int().min(1).max(365).default(1),
  nextRunDate: z.string(),
  lines: z.array(recurringLineSchema).min(1, "At least one line is required"),
  discount: z.number().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export const recurringUpdateSchema = z.object({
  partyId: z.string().optional(),
  warehouseId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  nextRunDate: z.string().optional(),
  isActive: z.boolean().optional(),
  lines: z.array(recurringLineSchema).optional(),
  discount: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const recurringSchema = z.object({
  id: z.string(),
  type: z.enum(["sales", "purchase"]),
  number: z.string(),
  partyId: z.string().optional(),
  partyName: z.string().optional(),
  warehouseId: z.string().optional(),
  warehouseName: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  interval: z.number().int().min(1).max(365),
  nextRunDate: z.string(),
  lastRunAt: z.string().optional(),
  lines: z.array(recurringLineSchema.extend({ id: z.string(), lineTotal: z.number() })),
  subtotal: z.number(),
  discount: z.number(),
  tax: z.number(),
  total: z.number(),
  isActive: z.boolean(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RecurringCreateInput = z.infer<typeof recurringCreateSchema>;
export type RecurringUpdateInput = z.infer<typeof recurringUpdateSchema>;
