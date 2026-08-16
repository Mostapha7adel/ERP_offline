import { z } from "zod";

export const alertItemSchema = z.object({
  kind: z.enum(["low-stock", "overdue-invoice", "expiring-batch", "recurring-due"]),
  severity: z.enum(["warning", "danger", "info"]),
  title: z.string(),
  message: z.string(),
  resource: z.string(),
  resourceId: z.string(),
  date: z.string().optional(),
});

export const alertsSummarySchema = z.object({
  lowStock: z.array(alertItemSchema),
  overdueInvoices: z.array(alertItemSchema),
  expiringBatches: z.array(alertItemSchema),
  recurringDue: z.array(alertItemSchema),
  counts: z.record(z.string(), z.number()),
  total: z.number(),
});