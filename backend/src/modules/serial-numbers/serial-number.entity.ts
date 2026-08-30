export type SerialNumberStatus = "IN_STOCK" | "SOLD" | "RETURNED" | "WARRANTY";

export interface SerialNumber {
  id: string;
  productId: string;
  serialNumber: string;
  status: SerialNumberStatus;
  warehouseId: string;
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
}
