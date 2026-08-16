export type PurchaseOrderStatus = "draft" | "pending" | "approved" | "partially_received" | "received" | "cancelled";

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId?: string;
  warehouseId?: string;
  orderDate: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
}