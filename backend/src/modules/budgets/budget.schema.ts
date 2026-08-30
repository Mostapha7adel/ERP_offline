import { z } from "zod";

export const budgetCreateSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  period: z.string().regex(/^\d{4}(-Q[1-4]|-\d{2})$/, "Period must be YYYY-MM or YYYY-Qn"),
  amount: z.number().nonnegative("Amount must be non-negative"),
  notes: z.string().max(2000).optional(),
});

export const budgetUpdateSchema = z.object({
  amount: z.number().nonnegative("Amount must be non-negative").optional(),
  notes: z.string().max(2000).optional(),
});

export const budgetSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  period: z.string(),
  amount: z.number(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
