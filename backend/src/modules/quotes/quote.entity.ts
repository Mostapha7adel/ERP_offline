import type { InvoiceType } from "../trade/invoice.entity.js";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export interface QuoteLine {
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

export interface Quote {
  id: string;
  type: InvoiceType;
  number: string;
  partyId?: string;
  quoteDate: string;
  validUntil?: string;
  warehouseId?: string;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: QuoteStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
