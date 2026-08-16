export type InvoiceType = "sales" | "purchase";
export type InvoiceStatus = "draft" | "issued" | "partial" | "paid" | "void";

export interface InvoiceLine {
  id: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  number: string;
  customerId?: string;
  supplierId?: string;
  invoiceDate: string;
  dueDate?: string;
  warehouseId?: string;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  currency: string;
  received: boolean;
  status: InvoiceStatus;
  paymentMethod?: string;
  notes?: string;
  quoteId?: string;
  purchaseOrderId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
