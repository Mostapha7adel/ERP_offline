import type {
  Party,
  Product,
  Warehouse,
  StockItem,
  Invoice,
  InvoiceLine,
  Account,
  JournalEntry,
  JournalEntryLine,
  BankAccount,
  MoneyTransaction,
  AppUser,
  AppRole,
  AppNotification,
  AuditLog,
  Address,
} from "@/types/domain";
import { mapBackendPermissions } from "./permissions";

interface BackendParty {
  id: string;
  type: "customer" | "supplier";
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  creditLimit?: number;
  currency?: string;
  notes?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

function toAddress(
  street?: string,
  city?: string,
  zip?: string,
  country?: string,
  state?: string,
): Address {
  return {
    street: street ?? "",
    city: city ?? "",
    state: state ?? "",
    country: country ?? "",
    postalCode: zip ?? "",
  };
}

export function mapParty(p: BackendParty): Party {
  return {
    id: p.id,
    type: p.type,
    code: p.code,
    name: p.name,
    email: p.email ?? "",
    phone: p.phone ?? "",
    taxId: p.taxNumber ?? "",
    currency: p.currency ?? "USD",
    paymentTerms: p.creditLimit != null ? String(p.creditLimit) : "",
    address: toAddress(p.address, p.city),
    balance: 0,
    status: p.status,
    createdAt: p.createdAt,
    note: p.notes,
  };
}

interface BackendProduct {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  type: "product" | "service";
  category?: string;
  brand?: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  taxRate: number;
  imageUrl?: string;
  trackStock: boolean;
  reorderLevel?: number;
  status: "active" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
}

export function mapProduct(p: BackendProduct): Product {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category ?? "",
    unit: p.unit,
    costPrice: p.purchasePrice,
    salePrice: p.salePrice,
    taxRate: p.taxRate,
    reorderLevel: p.reorderLevel ?? 0,
    description: p.description ?? "",
    status: p.status === "active" ? "active" : "inactive",
    createdAt: p.createdAt,
  };
}

interface BackendWarehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  manager?: string;
  phone?: string;
  isDefault: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export function mapWarehouse(w: BackendWarehouse): Warehouse {
  return {
    id: w.id,
    code: w.code,
    name: w.name,
    location: w.address ?? "",
    manager: w.manager ?? "",
    capacity: 0,
    status: w.status,
    createdAt: w.createdAt,
  };
}

interface BackendStockItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  reservedQuantity: number;
  reorderLevel: number;
  averageCost: number;
  createdAt?: string;
  updatedAt?: string;
}

export function mapStockItem(s: BackendStockItem): StockItem {
  return {
    id: s.id,
    productId: s.productId,
    warehouseId: s.warehouseId,
    quantity: s.quantityOnHand,
    committed: s.reservedQuantity,
    batchNumber: "",
    expiryDate: "",
  };
}

interface BackendInvoiceLine {
  id: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  lineTotal: number;
}

function mapInvoiceLine(l: BackendInvoiceLine): InvoiceLine {
  return {
    id: l.id,
    productId: l.productId ?? "",
    description: l.description ?? l.productName,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate ?? 0,
    discount: l.discount ?? 0,
    lineTotal: l.lineTotal,
  };
}

interface BackendInvoice {
  id: string;
  type: "sales" | "purchase";
  number: string;
  customerId?: string;
  supplierId?: string;
  invoiceDate: string;
  dueDate?: string;
  warehouseId?: string;
  lines: BackendInvoiceLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  received: boolean;
  status: "draft" | "issued" | "partial" | "paid" | "void";
  paymentMethod?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  supplierName?: string;
  warehouseName?: string;
  balance?: number;
}

function mapInvoiceStatus(
  status: BackendInvoice["status"],
): Invoice["status"] {
  switch (status) {
    case "paid":
      return "paid";
    case "partial":
    case "issued":
      return "pending";
    case "void":
      return "cancelled";
    case "draft":
    default:
      return "draft";
  }
}

export function mapInvoice(i: BackendInvoice): Invoice {
  const kind = i.type === "sales" ? "sale" : "purchase";
  const partyId = i.type === "sales" ? i.customerId : i.supplierId;
  return {
    id: i.id,
    kind,
    number: i.number,
    partyId: partyId ?? "",
    issueDate: i.invoiceDate,
    dueDate: i.dueDate ?? i.invoiceDate,
    status: mapInvoiceStatus(i.status),
    currency: "USD",
    subtotal: i.subtotal,
    discount: i.discount,
    tax: i.tax,
    total: i.total,
    paid: i.paidAmount,
    warehouseId: i.warehouseId,
    warehouseName: i.warehouseName,
    received: i.received,
    lines: (i.lines ?? []).map(mapInvoiceLine),
    note: i.notes,
    createdBy: i.createdBy,
    createdAt: i.createdAt,
  };
}

interface BackendAccount {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  category: string;
  isActive: boolean;
  openingBalance: number;
  parentCode?: string;
  createdAt: string;
  updatedAt: string;
}

export function mapAccount(a: BackendAccount): Account {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    category: a.category,
    parentId: a.parentCode,
    openingBalance: a.openingBalance,
    balance: a.openingBalance,
    isActive: a.isActive,
  };
}

interface BackendJournalLine {
  accountCode: string;
  description?: string;
  debit: number;
  credit: number;
}

interface BackendJournalEntry {
  id: string;
  number: string;
  date: string;
  memo?: string;
  status: "draft" | "posted" | "void";
  lines: BackendJournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function mapJournalEntry(
  j: BackendJournalEntry,
  accountsByCode: Map<string, string>,
): JournalEntry {
  const lines: JournalEntryLine[] = j.lines.map((l, index) => ({
    id: `${j.id}-${index}`,
    accountId: accountsByCode.get(l.accountCode) ?? l.accountCode,
    debit: l.debit,
    credit: l.credit,
  }));
  return {
    id: j.id,
    number: j.number,
    date: j.date,
    reference: j.memo ?? "",
    description: j.memo ?? "",
    status: j.status === "void" ? "reversed" : j.status,
    lines,
    createdBy: j.createdBy,
    createdAt: j.createdAt,
  };
}

interface BackendTreasuryAccount {
  id: string;
  name: string;
  type: "cash" | "bank" | "credit-card" | "paypal" | "other";
  currency: string;
  openingBalance: number;
  balance: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export function mapBankAccount(a: BackendTreasuryAccount): BankAccount {
  const type =
    a.type === "credit-card"
      ? "credit"
      : a.type === "cash"
        ? "cash"
        : a.type === "bank"
          ? "checking"
          : "savings";
  return {
    id: a.id,
    name: a.name,
    type,
    number: "",
    currency: a.currency,
    balance: a.balance,
    openingBalance: a.openingBalance,
    isActive: a.isActive,
  };
}

interface BackendTransaction {
  id: string;
  accountId: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  partyType?: string;
  partyId?: string;
  reference?: string;
  description?: string;
  date: string;
  createdBy: string;
  createdAt: string;
  reversed?: boolean;
}

export function mapMoneyTransaction(t: BackendTransaction): MoneyTransaction {
  return {
    id: t.id,
    reference: t.reference ?? t.id,
    bankAccountId: t.accountId,
    date: t.date,
    type: t.type === "income" ? "inflow" : t.type === "expense" ? "outflow" : "transfer",
    category: t.category,
    description: t.description ?? "",
    amount: t.amount,
    status: t.reversed ? "reversed" : "completed",
    createdAt: t.createdAt,
  };
}

interface BackendUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: "active" | "inactive";
  phone?: string;
  jobTitle?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  roleName?: string;
  createdAt: string;
  updatedAt: string;
}

const USER_COLORS = [
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#059669",
  "#ea580c",
  "#ca8a04",
  "#2563eb",
  "#16a34a",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function mapUser(u: BackendUser): AppUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleId: u.roleId,
    status: u.status === "active" ? "active" : u.status === "inactive" ? "suspended" : "invited",
    lastActiveAt: u.lastLoginAt ?? u.updatedAt,
    createdAt: u.createdAt,
    color: USER_COLORS[hashString(u.email) % USER_COLORS.length] ?? "#7c3aed",
    phone: u.phone,
    jobTitle: u.jobTitle,
    avatarUrl: u.avatarUrl,
  };
}

interface BackendRole {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  permissions: string[];
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapRole(r: BackendRole): AppRole {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    isSystem: r.isSystem ?? false,
    permissions: mapBackendPermissions(r.permissions),
    avatarUrl: r.avatarUrl,
  };
}

interface BackendAuditLog {
  id: string;
  createdAt: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  details?: unknown;
}

export function mapAuditLog(a: BackendAuditLog): AuditLog {
  return {
    id: a.id,
    actor: a.actorEmail,
    action: a.action,
    target: a.resource,
    ip: a.ip ?? "",
    timestamp: a.createdAt,
  };
}

interface BackendNotification {
  id: string;
  kind: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
  actorId?: string;
  actorName?: string;
  resource?: string;
  resourceId?: string;
}

export function mapNotification(n: BackendNotification): AppNotification {
  const notification: AppNotification = {
    id: n.id,
    kind: n.kind,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt,
    actorId: n.actorId,
    actorName: n.actorName,
    resource: n.resource,
    resourceId: n.resourceId,
  };
  if (n.resource && n.resourceId) {
    notification.action = {
      label: "View",
      to: actionTarget(n.resource, n.resourceId),
    };
  }
  return notification;
}

function actionTarget(resource: string, resourceId: string): string {
  switch (resource) {
    case "customer":
      return `/app/customers/${resourceId}`;
    case "supplier":
      return `/app/suppliers/${resourceId}`;
    case "product":
      return `/app/products/${resourceId}`;
    case "invoice":
      return `/app/invoices/${resourceId}`;
    default:
      return "#";
  }
}
