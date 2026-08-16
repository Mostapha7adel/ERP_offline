import { z } from "zod";

export const advanceCreateSchema = z.object({
  partyId: z.string().min(1, "Customer is required"),
  amount: z.number().positive("Amount must be greater than zero"),
  currency: z.string().max(3).default("EGP"),
  date: z.string(),
  method: z.string().optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const advanceUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  date: z.string().optional(),
  method: z.string().optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const advanceAllocateSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.number().positive("Allocation amount must be greater than zero"),
});

export const advanceSchema = z.object({
  id: z.string(),
  partyId: z.string(),
  amount: z.number(),
  balance: z.number(),
  currency: z.string(),
  date: z.string(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdvanceCreateInput = z.infer<typeof advanceCreateSchema>;
export type AdvanceUpdateInput = z.infer<typeof advanceUpdateSchema>;
export type AdvanceAllocateInput = z.infer<typeof advanceAllocateSchema>;