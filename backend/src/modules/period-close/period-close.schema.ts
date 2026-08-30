import { z } from "zod";

export const periodCloseSchema = z.object({
  id: z.string(),
  period: z.string(),
  status: z.enum(["open", "closed"]),
  closedAt: z.string().optional(),
  closedBy: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const closePeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format"),
  notes: z.string().max(2000).optional(),
});

export const openPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format"),
});

export type ClosePeriodInput = z.infer<typeof closePeriodSchema>;
export type OpenPeriodInput = z.infer<typeof openPeriodSchema>;
