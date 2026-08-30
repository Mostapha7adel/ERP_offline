export type SalesReturnStatus = "issued" | "void";

export interface SalesReturnLine {
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

export interface SalesReturn {
  id: string;
  number: string;
  invoiceId?: string;
  customerId?: string;
  warehouseId?: string;
  returnDate: string;
  lines: SalesReturnLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: SalesReturnStatus;
  reason?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
