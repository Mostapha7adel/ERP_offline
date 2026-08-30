export type DeliveryNoteStatus = "pending" | "in_transit" | "received" | "cancelled";

export interface DeliveryNote {
  id: string;
  companyId: string;
  number: string;
  invoiceId?: string;
  partyId?: string;
  warehouseId?: string;
  deliveryDate: string;
  status: DeliveryNoteStatus;
  receivedBy?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DeliveryNoteLine {
  id: string;
  deliveryNoteId: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
