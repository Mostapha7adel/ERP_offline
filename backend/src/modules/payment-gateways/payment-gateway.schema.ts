import { z } from "zod";

export const paymentGatewayConfigCreateSchema = z.object({
  name: z.enum(["STRIPE", "PAYPAL", "FAWRY", "USDT"]),
  isActive: z.boolean().default(true),
  config: z.string().optional(),
});

export const paymentGatewayConfigUpdateSchema = z.object({
  name: z.enum(["STRIPE", "PAYPAL", "FAWRY", "USDT"]).optional(),
  isActive: z.boolean().optional(),
  config: z.string().optional(),
});

export const paymentGatewayTransactionCreateSchema = z.object({
  gatewayConfigId: z.string().min(1),
  invoiceId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("EGP"),
  externalRef: z.string().optional(),
  metadata: z.string().optional(),
});

export const paymentGatewayConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  config: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const paymentGatewayTransactionSchema = z.object({
  id: z.string(),
  gatewayConfigId: z.string(),
  invoiceId: z.string().optional(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  externalRef: z.string().optional(),
  metadata: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PaymentGatewayConfigCreateInput = z.infer<typeof paymentGatewayConfigCreateSchema>;
export type PaymentGatewayConfigUpdateInput = z.infer<typeof paymentGatewayConfigUpdateSchema>;
export type PaymentGatewayTransactionCreateInput = z.infer<typeof paymentGatewayTransactionCreateSchema>;
