export type LoyaltyTxnType = "earn" | "redeem" | "adjust";

export interface LoyaltyAccount {
  id: string;
  partyId: string;
  points: number;
  totalEarned: number;
  totalRedeemed: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  type: LoyaltyTxnType;
  points: number;
  invoiceId?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
