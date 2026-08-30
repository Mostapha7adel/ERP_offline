export type StockTransferStatus = "DRAFT" | "COMPLETED" | "CANCELLED";

export interface StockTransferLine {
  transferId: string;
  productId: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: StockTransferStatus;
  date: string;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: StockTransferLine[];
}
