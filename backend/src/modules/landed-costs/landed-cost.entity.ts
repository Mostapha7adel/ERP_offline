export type AllocationMethod = "value" | "quantity" | "weight";

export interface LandedCost {
  id: string;
  purchaseInvoiceId?: string;
  description: string;
  amount: number;
  allocationMethod: AllocationMethod;
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
