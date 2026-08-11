export type AccountType = "cash" | "bank" | "credit-card" | "paypal" | "other";
export type TreasuryTxnType = "income" | "expense" | "transfer";

export interface TreasuryAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: number;
  balance: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryTransaction {
  id: string;
  accountId: string;
  type: TreasuryTxnType;
  /** Magnitude of the transaction. Income/expense are stored positive; the
   *  source leg of a transfer is stored negative to record its direction. */
  amount: number;
  category: string;
  partyType?: "customer" | "supplier";
  partyId?: string;
  reference?: string;
  referenceId?: string;
  description?: string;
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** true when the transaction was reversed/voided (invoice void or manual delete). */
  reversed?: boolean;
}
