import { z } from "zod";

export const fiscalYearCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  startDate: z.string(),
  endDate: z.string(),
  notes: z.string().max(1000).optional(),
});

export const fiscalYearSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["open", "closed"]),
  closingJournalId: z.string().optional(),
  closedAt: z.string().optional(),
  closedBy: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FiscalYearCreateInput = z.infer<typeof fiscalYearCreateSchema>;
