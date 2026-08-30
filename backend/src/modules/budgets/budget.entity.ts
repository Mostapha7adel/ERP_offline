export interface Budget {
  id: string;
  accountId: string;
  period: string;
  amount: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
