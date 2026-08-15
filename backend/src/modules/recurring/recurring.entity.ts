import type { InvoiceType } from "../trade/invoice.entity.js";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringInvoiceLine {
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

export interface RecurringInvoice {
  id: string;
  type: InvoiceType;
  number: string;
  partyId?: string;
  warehouseId?: string;
  frequency: RecurringFrequency;
  interval: number;
  nextRunDate: string;
  lastRunAt?: string;
  lines: RecurringInvoiceLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  isActive: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
