export interface Setting {
  id: string;
  key: string;
  value: unknown;
  group: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  name: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  currency: string;
  fiscalYearStart: string; // MM-DD
  logoUrl?: string;
}

export interface Preferences {
  defaultWarehouseId?: string;
  lowStockThreshold: number;
  invoicePrefix: string;
  purchasePrefix: string;
  taxEnabled: boolean;
  defaultTaxRate: number;
  dateFormat: string;
  notifyOnLowStock: boolean;
  notifyOnInvoiceCreated: boolean;
  costingMethod: "average" | "fifo";
  enforceCreditLimit: boolean;
  autoBackupEnabled: boolean;
  autoBackupFrequencyHours: number;
  autoBackupRetention: number;
  autoBackupFolder: string;
}
