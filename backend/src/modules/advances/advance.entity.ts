export interface CustomerAdvance {
  id: string;
  partyId: string;
  amount: number;
  balance: number;
  currency: string;
  date: string;
  method?: string;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvanceAllocation {
  id: string;
  advanceId: string;
  invoiceId: string;
  amount: number;
  appliedAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}