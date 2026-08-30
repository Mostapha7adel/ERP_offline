export type WarrantyStatus = "ACTIVE" | "EXPIRED" | "CLAIMED";

export interface Warranty {
  id: string;
  productId: string;
  serialNumberId?: string;
  customerId: string;
  warrantyNumber: string;
  startDate: string;
  endDate: string;
  status: WarrantyStatus;
  invoiceId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
