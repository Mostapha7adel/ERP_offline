import { z } from "zod";

export const loyaltyAccountSchema = z.object({
  id: z.string(),
  partyId: z.string(),
  points: z.number(),
  totalEarned: z.number(),
  totalRedeemed: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const loyaltyTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  type: z.enum(["earn", "redeem", "adjust"]),
  points: z.number(),
  invoiceId: z.string().optional(),
  description: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const loyaltyEarnSchema = z.object({
  partyId: z.string().min(1, "Party ID is required"),
  points: z.number().positive("Points must be positive"),
  invoiceId: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const loyaltyRedeemSchema = z.object({
  partyId: z.string().min(1, "Party ID is required"),
  points: z.number().positive("Points must be positive"),
  invoiceId: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const loyaltyAdjustSchema = z.object({
  partyId: z.string().min(1, "Party ID is required"),
  points: z.number().describe("Positive to add, negative to deduct"),
  description: z.string().max(500).optional(),
});

export type LoyaltyEarnInput = z.infer<typeof loyaltyEarnSchema>;
export type LoyaltyRedeemInput = z.infer<typeof loyaltyRedeemSchema>;
export type LoyaltyAdjustInput = z.infer<typeof loyaltyAdjustSchema>;
