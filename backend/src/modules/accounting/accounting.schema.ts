import { z } from "zod";

export const accountCreateSchema = z.object({
  code: z.string().min(1, "Code is required").max(30),
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  category: z.string().min(1, "Category is required").max(100),
  isActive: z.boolean().default(true),
  openingBalance: z.number().default(0),
  parentCode: z.string().max(30).optional(),
});

export const accountUpdateSchema = accountCreateSchema.partial();

export const accountSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  category: z.string(),
  isActive: z.boolean(),
  openingBalance: z.number(),
  parentCode: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const journalLineSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  description: z.string().max(300).optional(),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
});

export const journalCreateSchema = z.object({
  date: z.string(),
  memo: z.string().max(1000).optional(),
  lines: z.array(journalLineSchema).min(2, "A journal entry needs at least two lines"),
});

export const journalSchema = z.object({
  id: z.string(),
  number: z.string(),
  date: z.string(),
  memo: z.string().optional(),
  status: z.enum(["draft", "posted", "void"]),
  lines: z.array(journalLineSchema.extend({ description: z.string().optional() })),
  totalDebit: z.number(),
  totalCredit: z.number(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type JournalCreateInput = z.infer<typeof journalCreateSchema>;
