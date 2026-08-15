export type TradeNoteType = "credit" | "debit";
export type TradeNoteStatus = "issued" | "void";
export type NoteInvoiceType = "sales" | "purchase";

export interface TradeNoteLine {
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

export interface TradeNote {
  id: string;
  type: NoteInvoiceType;
  noteType: TradeNoteType;
  number: string;
  invoiceId?: string;
  partyId?: string;
  warehouseId?: string;
  noteDate: string;
  lines: TradeNoteLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: TradeNoteStatus;
  reason?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
