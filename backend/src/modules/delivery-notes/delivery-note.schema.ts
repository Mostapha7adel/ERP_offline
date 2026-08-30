import { z } from "zod";

export const deliveryNoteLineSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required").max(200),
  description: z.string().max(500).optional(),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative().default(0),
  lineTotal: z.number().nonnegative().default(0),
});

export const deliveryNoteLineWithIdSchema = deliveryNoteLineSchema.extend({
  id: z.string(),
  deliveryNoteId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
});

export const deliveryNoteCreateSchema = z.object({
  invoiceId: z.string().optional(),
  partyId: z.string().optional(),
  warehouseId: z.string().optional(),
  deliveryDate: z.string().optional(),
  receivedBy: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(deliveryNoteLineSchema).min(1, "At least one line is required"),
});

export const deliveryNoteUpdateSchema = z.object({
  partyId: z.string().optional(),
  warehouseId: z.string().optional(),
  deliveryDate: z.string().optional(),
  status: z.enum(["pending", "in_transit", "received", "cancelled"]).optional(),
  receivedBy: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(deliveryNoteLineSchema).optional(),
});

export const deliveryNoteSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  number: z.string(),
  invoiceId: z.string().optional(),
  partyId: z.string().optional(),
  warehouseId: z.string().optional(),
  deliveryDate: z.string(),
  status: z.enum(["pending", "in_transit", "received", "cancelled"]),
  receivedBy: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
});

export type DeliveryNoteCreateInput = z.infer<typeof deliveryNoteCreateSchema>;
export type DeliveryNoteUpdateInput = z.infer<typeof deliveryNoteUpdateSchema>;
