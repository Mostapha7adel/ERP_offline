import { z } from "zod";

export const currencyCreateSchema = z.object({
  code: z.string().min(1).max(3),
  name: z.string().max(100).optional(),
  symbol: z.string().max(10).optional(),
  rate: z.number().positive("Rate must be greater than zero"),
  isBase: z.boolean().default(false),
});

export const currencyUpdateSchema = currencyCreateSchema.partial();

export const currencySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  rate: z.number(),
  isBase: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CurrencyCreateInput = z.infer<typeof currencyCreateSchema>;
export type CurrencyUpdateInput = z.infer<typeof currencyUpdateSchema>;