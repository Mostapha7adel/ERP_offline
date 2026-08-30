import type {
  Party,
  Product,
  Warehouse,
  StockItem,
  Invoice,
  InvoiceLine,
  Quote,
  QuoteLine,
  QuoteStatus,
  RecurringInvoice,
  RecurringFrequency,
  TradeNote,
  TradeNoteLine,
  FiscalYear,
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
  CurrencyRate,
  PurchaseOrder,
  PurchaseOrderLine,
  Asset,
  AssetDepreciationRun,
  CustomerAdvance,
  AdvanceAllocation,
  PaymentVoucher,
  SalesReturn,
  SalesReturnLine,
  PurchaseReturn,
  PurchaseReturnLine,
  PriceList,
  PriceListItem,
  DeliveryNote,
  DeliveryNoteLine,
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
    paymentTerms: "",
    creditLimit: p.creditLimit,
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
    barcode: p.barcode ?? undefined,
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
  quoteId?: string;
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
    quoteId: i.quoteId,
    createdBy: i.createdBy,
    createdAt: i.createdAt,
  };
}

interface BackendQuoteLine {
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

interface BackendQuote {
  id: string;
  type: "sales" | "purchase";
  number: string;
  partyId?: string;
  quoteDate: string;
  validUntil?: string;
  warehouseId?: string;
  lines: BackendQuoteLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: QuoteStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  partyName?: string;
  warehouseName?: string;
}

function mapQuoteLine(l: BackendQuoteLine): QuoteLine {
  return {
    id: l.id,
    productId: l.productId,
    description: l.description ?? l.productName,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate,
    discount: l.discount,
    lineTotal: l.lineTotal,
  };
}

export function mapQuote(q: BackendQuote): Quote {
  return {
    id: q.id,
    kind: q.type === "sales" ? "sale" : "purchase",
    number: q.number,
    partyId: q.partyId ?? "",
    partyName: q.partyName,
    quoteDate: q.quoteDate,
    validUntil: q.validUntil,
    warehouseId: q.warehouseId,
    warehouseName: q.warehouseName,
    status: q.status,
    currency: "USD",
    subtotal: q.subtotal,
    discount: q.discount,
    tax: q.tax,
    total: q.total,
    lines: (q.lines ?? []).map(mapQuoteLine),
    note: q.notes,
    createdBy: q.createdBy,
    createdAt: q.createdAt,
  };
}

interface BackendRecurringLine {
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

interface BackendRecurring {
  id: string;
  type: "sales" | "purchase";
  number: string;
  partyId?: string;
  warehouseId?: string;
  frequency: RecurringFrequency;
  interval: number;
  nextRunDate: string;
  lastRunAt?: string;
  lines: BackendRecurringLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  isActive: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  partyName?: string;
  warehouseName?: string;
}

export function mapRecurring(r: BackendRecurring): RecurringInvoice {
  return {
    id: r.id,
    kind: r.type === "sales" ? "sale" : "purchase",
    number: r.number,
    partyId: r.partyId ?? "",
    partyName: r.partyName,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouseName,
    frequency: r.frequency,
    interval: r.interval,
    nextRunDate: r.nextRunDate,
    lastRunAt: r.lastRunAt,
    status: r.isActive ? "active" : "inactive",
    currency: "USD",
    subtotal: r.subtotal,
    discount: r.discount,
    tax: r.tax,
    total: r.total,
    lines: (r.lines ?? []).map((l) => mapQuoteLine(l)),
    note: r.notes,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  };
}

interface BackendTradeNoteLine {
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

interface BackendTradeNote {
  id: string;
  type: "sales" | "purchase";
  noteType: "credit" | "debit";
  number: string;
  invoiceId?: string;
  partyId?: string;
  warehouseId?: string;
  noteDate: string;
  lines: BackendTradeNoteLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: "issued" | "void";
  reason?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  partyName?: string;
  invoiceNumber?: string;
  warehouseName?: string;
}

function mapTradeNoteLine(l: BackendTradeNoteLine): TradeNoteLine {
  return {
    id: l.id,
    productId: l.productId,
    productName: l.productName,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount,
    taxRate: l.taxRate,
    lineTotal: l.lineTotal,
  };
}

export function mapTradeNote(n: BackendTradeNote): TradeNote {
  return {
    id: n.id,
    type: n.type,
    noteType: n.noteType,
    number: n.number,
    invoiceId: n.invoiceId,
    partyId: n.partyId,
    warehouseId: n.warehouseId,
    noteDate: n.noteDate,
    lines: (n.lines ?? []).map(mapTradeNoteLine),
    subtotal: n.subtotal,
    discount: n.discount,
    tax: n.tax,
    total: n.total,
    status: n.status,
    reason: n.reason,
    notes: n.notes,
    createdBy: n.createdBy,
    createdAt: n.createdAt,
    partyName: n.partyName,
    invoiceNumber: n.invoiceNumber,
    warehouseName: n.warehouseName,
  };
}

interface BackendFiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
  closingJournalId?: string;
  closedAt?: string;
  closedBy?: string;
  notes?: string;
  revenue?: number;
  expenses?: number;
  netProfit?: number;
  createdAt: string;
  updatedAt: string;
}

export function mapFiscalYear(f: BackendFiscalYear): FiscalYear {
  return {
    id: f.id,
    name: f.name,
    startDate: f.startDate,
    endDate: f.endDate,
    status: f.status,
    closingJournalId: f.closingJournalId,
    closedAt: f.closedAt,
    closedBy: f.closedBy,
    notes: f.notes,
    revenue: f.revenue ?? 0,
    expenses: f.expenses ?? 0,
    netProfit: f.netProfit ?? 0,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
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

interface BackendCurrencyRate {
  id: string;
  code: string;
  name?: string;
  symbol?: string;
  rate: number;
  isBase: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapCurrencyRate(c: BackendCurrencyRate): CurrencyRate {
  return {
    id: c.id,
    code: c.code,
    name: c.name ?? "",
    symbol: c.symbol ?? "",
    rate: c.rate,
    isBase: c.isBase,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

interface BackendPurchaseOrderLine {
  id: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  lineTotal: number;
}

function mapPurchaseOrderLine(l: BackendPurchaseOrderLine): PurchaseOrderLine {
  return {
    id: l.id,
    purchaseOrderId: "",
    productId: l.productId ?? "",
    productName: l.productName,
    description: l.description,
    quantity: l.quantity,
    receivedQty: l.receivedQty,
    unitPrice: l.unitPrice,
    discount: l.discount ?? 0,
    taxRate: l.taxRate ?? 0,
    lineTotal: l.lineTotal,
  };
}

interface BackendPurchaseOrder {
  id: string;
  number: string;
  supplierId?: string;
  warehouseId?: string;
  orderDate: string;
  expectedDate?: string;
  status: PurchaseOrder["status"];
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
  lines?: BackendPurchaseOrderLine[];
  supplierName?: string;
  warehouseName?: string;
  orderedQty?: number;
  receivedQty?: number;
  invoiceId?: string;
}

export function mapPurchaseOrder(po: BackendPurchaseOrder): PurchaseOrder {
  return {
    id: po.id,
    number: po.number,
    supplierId: po.supplierId ?? "",
    supplierName: po.supplierName,
    warehouseId: po.warehouseId,
    warehouseName: po.warehouseName,
    orderDate: po.orderDate,
    expectedDate: po.expectedDate,
    status: po.status,
    subtotal: po.subtotal,
    discount: po.discount,
    tax: po.tax,
    total: po.total,
    currency: po.currency,
    notes: po.notes,
    approvedBy: po.approvedBy,
    approvedAt: po.approvedAt,
    createdBy: po.createdBy,
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
    lines: (po.lines ?? []).map((l) => ({
      ...mapPurchaseOrderLine(l),
      purchaseOrderId: po.id,
    })),
    orderedQty: po.orderedQty,
    receivedQty: po.receivedQty,
    invoiceId: po.invoiceId,
  };
}

interface BackendAssetDepreciationRun {
  id: string;
  assetId: string;
  period: string;
  amount: number;
  accumulated?: number;
  bookValueAfter?: number;
  createdAt: string;
  updatedAt: string;
}

function mapDepreciationRun(
  r: BackendAssetDepreciationRun,
): AssetDepreciationRun {
  return {
    id: r.id,
    assetId: r.assetId,
    period: r.period,
    amount: r.amount,
    bookValueAfter: r.bookValueAfter ?? r.accumulated ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

interface BackendAsset {
  id: string;
  code: string;
  name: string;
  category?: string;
  purchaseDate?: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  currentValue: number;
  accountId?: string;
  accumulatedDepreciationAccountId?: string;
  depreciationExpenseAccountId?: string;
  status: "active" | "disposed" | "writtenOff";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  accumulatedDepreciation?: number;
  bookValue?: number;
  bookValueExpected?: number;
  runs?: BackendAssetDepreciationRun[];
  accountName?: string;
  accumulatedDepreciationAccountName?: string;
  depreciationExpenseAccountName?: string;
}

export function mapAsset(a: BackendAsset): Asset {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    category: a.category,
    purchaseDate: a.purchaseDate ?? "",
    cost: a.cost,
    salvageValue: a.salvageValue,
    usefulLifeMonths: a.usefulLifeMonths,
    depreciationMethod:
      a.depreciationMethod === "declining" ? "declining" : "straight-line",
    currentValue: a.currentValue,
    accumulatedDepreciation: a.accumulatedDepreciation ?? 0,
    bookValue: a.bookValue ?? a.bookValueExpected ?? a.cost,
    status:
      a.status === "writtenOff"
        ? "disposed"
        : a.status === "disposed"
          ? "disposed"
          : "active",
    accountId: a.accountId,
    accountName: a.accountName,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    runs: (a.runs ?? []).map(mapDepreciationRun),
  };
}

interface BackendAdvanceAllocation {
  id: string;
  advanceId: string;
  invoiceId: string;
  amount: number;
  appliedAt?: string;
  invoiceNumber?: string;
}

function mapAllocation(a: BackendAdvanceAllocation): AdvanceAllocation {
  return {
    id: a.id,
    advanceId: a.advanceId,
    invoiceId: a.invoiceId,
    invoiceNumber: a.invoiceNumber,
    amount: a.amount,
    allocatedAt: a.appliedAt ?? new Date().toISOString(),
  };
}

interface BackendCustomerAdvance {
  id: string;
  partyId: string;
  amount: number;
  balance: number;
  currency: string;
  date: string;
  method?: string;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  partyName?: string;
  allocations?: BackendAdvanceAllocation[];
}

export function mapCustomerAdvance(a: BackendCustomerAdvance): CustomerAdvance {
  return {
    id: a.id,
    partyId: a.partyId,
    partyName: a.partyName,
    amount: a.amount,
    balance: a.balance,
    currency: a.currency,
    date: a.date,
    method: a.method,
    reference: a.reference,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    allocations: (a.allocations ?? []).map(mapAllocation),
  };
}

// ---- Payment Vouchers ----

interface BackendPaymentVoucher {
  id: string;
  number: string;
  type: "receipt" | "payment";
  date: string;
  partyId?: string;
  partyName?: string;
  accountId: string;
  accountName?: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  description?: string;
  status: "draft" | "approved" | "cancelled";
  createdBy: string;
  createdAt: string;
}

export function mapPaymentVoucher(p: BackendPaymentVoucher): PaymentVoucher {
  return {
    id: p.id,
    number: p.number,
    type: p.type,
    date: p.date,
    partyId: p.partyId,
    partyName: p.partyName,
    accountId: p.accountId,
    accountName: p.accountName,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    reference: p.reference,
    description: p.description,
    status: p.status,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
  };
}

// ---- Sales Returns ----

interface BackendSalesReturnLine {
  id: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

interface BackendSalesReturn {
  id: string;
  number: string;
  customerId: string;
  customerName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  warehouseId?: string;
  warehouseName?: string;
  returnDate: string;
  lines: BackendSalesReturnLine[];
  subtotal: number;
  tax: number;
  total: number;
  reason?: string;
  status: "draft" | "issued" | "cancelled";
  createdBy: string;
  createdAt: string;
}

function mapSalesReturnLine(l: BackendSalesReturnLine): SalesReturnLine {
  return {
    id: l.id,
    productId: l.productId,
    productName: l.productName,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate,
    lineTotal: l.lineTotal,
  };
}

export function mapSalesReturn(r: BackendSalesReturn): SalesReturn {
  return {
    id: r.id,
    number: r.number,
    customerId: r.customerId,
    customerName: r.customerName,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouseName,
    returnDate: r.returnDate,
    lines: (r.lines ?? []).map(mapSalesReturnLine),
    subtotal: r.subtotal,
    tax: r.tax,
    total: r.total,
    reason: r.reason,
    status: r.status,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  };
}

// ---- Purchase Returns ----

interface BackendPurchaseReturnLine {
  id: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

interface BackendPurchaseReturn {
  id: string;
  number: string;
  supplierId: string;
  supplierName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  warehouseId?: string;
  warehouseName?: string;
  returnDate: string;
  lines: BackendPurchaseReturnLine[];
  subtotal: number;
  tax: number;
  total: number;
  reason?: string;
  status: "draft" | "issued" | "cancelled";
  createdBy: string;
  createdAt: string;
}

function mapPurchaseReturnLine(l: BackendPurchaseReturnLine): PurchaseReturnLine {
  return {
    id: l.id,
    productId: l.productId,
    productName: l.productName,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate,
    lineTotal: l.lineTotal,
  };
}

export function mapPurchaseReturn(r: BackendPurchaseReturn): PurchaseReturn {
  return {
    id: r.id,
    number: r.number,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouseName,
    returnDate: r.returnDate,
    lines: (r.lines ?? []).map(mapPurchaseReturnLine),
    subtotal: r.subtotal,
    tax: r.tax,
    total: r.total,
    reason: r.reason,
    status: r.status,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  };
}

// ---- Price Lists ----

interface BackendPriceListItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  minQuantity?: number;
}

interface BackendPriceList {
  id: string;
  name: string;
  code: string;
  currency: string;
  items: BackendPriceListItem[];
  status: "active" | "inactive";
  notes?: string;
  createdBy: string;
  createdAt: string;
}

function mapPriceListItem(i: BackendPriceListItem): PriceListItem {
  return {
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    price: i.price,
    minQuantity: i.minQuantity,
  };
}

export function mapPriceList(p: BackendPriceList): PriceList {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    currency: p.currency,
    items: (p.items ?? []).map(mapPriceListItem),
    status: p.status,
    notes: p.notes,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
  };
}

// ---- Delivery Notes ----

interface BackendDeliveryNoteLine {
  id: string;
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  deliveredQuantity: number;
}

interface BackendDeliveryNote {
  id: string;
  number: string;
  orderId?: string;
  orderNumber?: string;
  supplierId: string;
  supplierName?: string;
  warehouseId: string;
  warehouseName?: string;
  expectedDate: string;
  receivedDate?: string;
  lines: BackendDeliveryNoteLine[];
  status: "pending" | "delivered" | "cancelled";
  notes?: string;
  createdBy: string;
  createdAt: string;
}

function mapDeliveryNoteLine(l: BackendDeliveryNoteLine): DeliveryNoteLine {
  return {
    id: l.id,
    productId: l.productId,
    productName: l.productName,
    description: l.description,
    quantity: l.quantity,
    deliveredQuantity: l.deliveredQuantity,
  };
}

export function mapDeliveryNote(d: BackendDeliveryNote): DeliveryNote {
  return {
    id: d.id,
    number: d.number,
    orderId: d.orderId,
    orderNumber: d.orderNumber,
    supplierId: d.supplierId,
    supplierName: d.supplierName,
    warehouseId: d.warehouseId,
    warehouseName: d.warehouseName,
    expectedDate: d.expectedDate,
    receivedDate: d.receivedDate,
    lines: (d.lines ?? []).map(mapDeliveryNoteLine),
    status: d.status,
    notes: d.notes,
    createdBy: d.createdBy,
    createdAt: d.createdAt,
  };
}
