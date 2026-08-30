import { z } from "zod";

export const serialNumberCreateSchema = z.object({
  productId: z.string().min(1),
  serialNumber: z.string().min(1, "Serial number is required").max(100),
  warehouseId: z.string().min(1),
  status: z.enum(["IN_STOCK", "SOLD", "RETURNED", "WARRANTY"]).default("IN_STOCK"),
});

export const serialNumberBulkCreateSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  serialNumbers: z.array(z.string().min(1).max(100)).min(1, "At least one serial number is required"),
});

export const serialNumberAssignSchema = z.object({
  serialNumberId: z.string().min(1),
  invoiceId: z.string().min(1),
});

export const serialNumberReturnSchema = z.object({
  serialNumberId: z.string().min(1),
});

export const serialNumberSchema = z.object({
  id: z.string(),
  productId: z.string(),
  serialNumber: z.string(),
  status: z.enum(["IN_STOCK", "SOLD", "RETURNED", "WARRANTY"]),
  warehouseId: z.string(),
  invoiceId: z.string().optional(),
  createdAt: z.string(),
});

export type SerialNumberCreateInput = z.infer<typeof serialNumberCreateSchema>;
export type SerialNumberBulkCreateInput = z.infer<typeof serialNumberBulkCreateSchema>;
export type SerialNumberAssignInput = z.infer<typeof serialNumberAssignSchema>;
export type SerialNumberReturnInput = z.infer<typeof serialNumberReturnSchema>;
