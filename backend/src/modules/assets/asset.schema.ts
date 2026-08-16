import { z } from "zod";

export const assetCreateSchema = z.object({
  code: z.string().min(1, "Code is required").max(30),
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(100).optional(),
  purchaseDate: z.string().optional(),
  cost: z.number().nonnegative().default(0),
  salvageValue: z.number().nonnegative().default(0),
  usefulLifeMonths: z.number().int().positive("Useful life must be greater than zero"),
  depreciationMethod: z.enum(["straight-line", "declining"]).default("straight-line"),
  currentValue: z.number().nonnegative().optional(),
  accountId: z.string().optional(),
  accumulatedDepreciationAccountId: z.string().optional(),
  depreciationExpenseAccountId: z.string().optional(),
  status: z.enum(["active", "disposed", "writtenOff"]).default("active"),
  notes: z.string().max(2000).optional(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export const assetSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  category: z.string().optional(),
  purchaseDate: z.string().optional(),
  cost: z.number(),
  salvageValue: z.number(),
  usefulLifeMonths: z.number(),
  depreciationMethod: z.string(),
  currentValue: z.number(),
  accountId: z.string().optional(),
  accumulatedDepreciationAccountId: z.string().optional(),
  depreciationExpenseAccountId: z.string().optional(),
  status: z.enum(["active", "disposed", "writtenOff"]),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const depreciateSchema = z.object({
  /** YYYY-MM period to run depreciation for. Defaults to the current month. */
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format").optional(),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;