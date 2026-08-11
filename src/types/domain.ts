export type ID = string;
export type ISOString = string;

export type Status = "active" | "inactive" | "draft" | "pending" | "paid" | "overdue" | "cancelled" | "completed" | "processing" | "failed" | "archived";

export type PartyType = "customer" | "supplier";

export type PartyStatus = "active" | "inactive" | "blocked";

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface Party {
  id: ID;
  type: PartyType;
  code: string;
  name: string;
  email: string;
  phone: string;
  taxId: string;
  currency: string;
  paymentTerms: string;
  address: Address;
  balance: number;
  status: PartyStatus;
  createdAt: ISOString;
  note?: string;
}

export type ProductStatus = "active" | "inactive";

export interface Product {
  id: ID;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  taxRate: number;
  reorderLevel: number;
  description: string;
  status: ProductStatus;
  createdAt: ISOString;
}

export type WarehouseStatus = "active" | "inactive";

export interface Warehouse {
  id: ID;
  code: string;
  name: string;
  location: string;
  manager: string;
  capacity: number;
  status: WarehouseStatus;
  createdAt: ISOString;
}

export interface StockItem {
  id: ID;
  productId: ID;
  warehouseId: ID;
  quantity: number;
  committed: number;
  batchNumber: string;
  expiryDate: ISOString;
}

export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";
export type InvoiceKind = "sale" | "purchase";

export interface InvoiceLine {
  id: ID;
  productId: ID;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  lineTotal: number;
}

export interface Invoice {
  id: ID;
  kind: InvoiceKind;
  number: string;
  partyId: ID;
  issueDate: ISOString;
  dueDate: ISOString;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  warehouseId?: ID;
  warehouseName?: string;
  received?: boolean;
  lines: InvoiceLine[];
  note?: string;
  createdBy: ID;
  createdAt: ISOString;
}

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export interface Account {
  id: ID;
  code: string;
  name: string;
  type: AccountType;
  category: string;
  parentId?: ID;
  openingBalance: number;
  balance: number;
  isActive: boolean;
}

export interface JournalEntryLine {
  id: ID;
  accountId: ID;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: ID;
  number: string;
  date: ISOString;
  reference: string;
  description: string;
  status: "posted" | "draft" | "reversed";
  lines: JournalEntryLine[];
  createdBy: ID;
  createdAt: ISOString;
}

export type BankAccountType = "checking" | "savings" | "cash" | "credit";

export interface BankAccount {
  id: ID;
  name: string;
  type: BankAccountType;
  number: string;
  currency: string;
  balance: number;
  openingBalance: number;
  isActive: boolean;
}

export type TransactionStatus = "completed" | "pending" | "failed" | "reversed";

export interface MoneyTransaction {
  id: ID;
  reference: string;
  bankAccountId: ID;
  date: ISOString;
  type: "inflow" | "outflow" | "transfer";
  category: string;
  description: string;
  amount: number;
  status: TransactionStatus;
  createdAt: ISOString;
}

export type UserStatus = "active" | "invited" | "suspended";

export interface AppUser {
  id: ID;
  name: string;
  email: string;
  roleId: ID;
  status: UserStatus;
  lastActiveAt: ISOString;
  createdAt: ISOString;
  color: string;
  phone?: string;
  jobTitle?: string;
  avatarUrl?: string;
}

export interface AppRole {
  id: ID;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  avatarUrl?: string;
}

export type NotificationKind = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  createdAt: ISOString;
  actorId?: ID;
  actorName?: string;
  resource?: string;
  resourceId?: ID;
  action?: { label: string; to: string };
}

export interface AuditLog {
  id: ID;
  actor: string;
  action: string;
  target: string;
  ip: string;
  timestamp: ISOString;
}

export interface CompanyProfile {
  name: string;
  legalName: string;
  taxId: string;
  registrationNumber: string;
  email: string;
  phone: string;
  website: string;
  address: Address;
  currency: string;
  fiscalYearStart: string;
  timezone: string;
  logoInitials: string;
}

export interface AppPreferences {
  language: string;
  dateFormat: string;
  numberFormat: string;
  lowStockThreshold: number;
  currency: string;
  defaultTaxRate: number;
  showDecimals: boolean;
  notificationsEnabled: boolean;
  autoSave: boolean;
}

export interface BackupMeta {
  id: ID;
  name: string;
  createdAt: ISOString;
  size: number;
  type: "manual" | "auto";
  version: string;
}
