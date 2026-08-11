import { z } from "zod";
export const accountCreateSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    type: z.enum(["cash", "bank", "credit-card", "paypal", "other"]),
    currency: z.string().max(3).default("USD"),
    openingBalance: z.number().default(0),
    notes: z.string().max(500).optional(),
    isActive: z.boolean().default(true),
});
export const accountUpdateSchema = accountCreateSchema.partial();
export const accountSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["cash", "bank", "credit-card", "paypal", "other"]),
    currency: z.string(),
    openingBalance: z.number(),
    balance: z.number(),
    isActive: z.boolean(),
    notes: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export const transactionCreateSchema = z.object({
    accountId: z.string().min(1, "Account is required"),
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.number().positive("Amount must be positive"),
    category: z.string().min(1, "Category is required").max(100),
    partyType: z.enum(["customer", "supplier"]).optional(),
    partyId: z.string().optional(),
    reference: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    date: z.string().optional(),
});
export const transferSchema = z.object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amount: z.number().positive("Amount must be positive"),
    date: z.string().optional(),
    description: z.string().max(500).optional(),
});
export const transactionSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.number(),
    category: z.string(),
    partyType: z.enum(["customer", "supplier"]).optional(),
    partyId: z.string().optional(),
    reference: z.string().optional(),
    description: z.string().optional(),
    date: z.string(),
    createdBy: z.string(),
    createdAt: z.string(),
});
