export type PartyType = "customer" | "supplier";
export type PartyStatus = "active" | "inactive";

export interface Party {
  id: string;
  type: PartyType;
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  creditLimit?: number;
  currency: string;
  notes?: string;
  status: PartyStatus;
  createdAt: string;
  updatedAt: string;
}
