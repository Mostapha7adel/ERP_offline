export type PurchaseReturnStatus = "issued" | "void";

export interface PurchaseReturnLine {
  id: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

export interface PurchaseReturn {
  id: string;
  number: string;
  invoiceId?: string;
  supplierId?: string;
  warehouseId?: string;
  returnDate: string;
  lines: PurchaseReturnLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: PurchaseReturnStatus;
  reason?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
