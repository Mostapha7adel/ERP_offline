export type AssetStatus = "active" | "disposed" | "writtenOff";

export interface Asset {
  id: string;
  code: string;
  name: string;
  category?: string;
  purchaseDate?: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  currentValue: number;
  accountId?: string;
  accumulatedDepreciationAccountId?: string;
  depreciationExpenseAccountId?: string;
  status: AssetStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDepreciationRun {
  id: string;
  assetId: string;
  period: string;
  amount: number;
  accumulated: number;
  journalId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}