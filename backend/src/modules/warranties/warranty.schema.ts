import { z } from "zod";

export const warrantyCreateSchema = z.object({
  productId: z.string().min(1),
  serialNumberId: z.string().optional(),
  customerId: z.string().min(1),
  warrantyNumber: z.string().min(1, "Warranty number is required").max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  invoiceId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const warrantyClaimSchema = z.object({
  warrantyId: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export const warrantySchema = z.object({
  id: z.string(),
  productId: z.string(),
  serialNumberId: z.string().optional(),
  customerId: z.string(),
  warrantyNumber: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["ACTIVE", "EXPIRED", "CLAIMED"]),
  invoiceId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WarrantyCreateInput = z.infer<typeof warrantyCreateSchema>;
export type WarrantyClaimInput = z.infer<typeof warrantyClaimSchema>;
