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
  creditLimit?: number;
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
  barcode?: string;
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
  batchNumber?: string;
  expiryDate?: string;
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
  quoteId?: ID;
  createdBy: ID;
  createdAt: ISOString;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export interface QuoteLine {
  id: ID;
  productId?: ID;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  lineTotal: number;
}

export interface Quote {
  id: ID;
  kind: InvoiceKind;
  number: string;
  partyId: ID;
  partyName?: string;
  quoteDate: ISOString;
  validUntil?: ISOString;
  warehouseId?: ID;
  warehouseName?: string;
  status: QuoteStatus;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: QuoteLine[];
  note?: string;
  createdBy: ID;
  createdAt: ISOString;
}

export type TradeNoteType = "credit" | "debit";
export type TradeNoteStatus = "issued" | "void";

export interface TradeNoteLine {
  id: ID;
  productId?: ID;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

export interface TradeNote {
  id: ID;
  type: "sales" | "purchase";
  noteType: TradeNoteType;
  number: string;
  invoiceId?: ID;
  partyId?: ID;
  warehouseId?: ID;
  noteDate: ISOString;
  lines: TradeNoteLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: TradeNoteStatus;
  reason?: string;
  notes?: string;
  createdBy: ID;
  createdAt: ISOString;
  partyName?: string;
  invoiceNumber?: string;
  warehouseName?: string;
}

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringInvoice {
  id: ID;
  kind: InvoiceKind;
  number: string;
  partyId: ID;
  partyName?: string;
  warehouseId?: ID;
  warehouseName?: string;
  frequency: RecurringFrequency;
  interval: number;
  nextRunDate: ISOString;
  lastRunAt?: ISOString;
  status: "active" | "inactive";
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: QuoteLine[];
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

export type FiscalYearStatus = "open" | "closed";

export interface FiscalYear {
  id: ID;
  name: string;
  startDate: ISOString;
  endDate: ISOString;
  status: FiscalYearStatus;
  closingJournalId?: ID;
  closedAt?: ISOString;
  closedBy?: ID;
  notes?: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  createdAt: ISOString;
  updatedAt: ISOString;
}

export interface PartyStatementRow {
  date: ISOString;
  kind: "invoice" | "payment" | "credit-note" | "debit-note";
  ref: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface PartyStatement {
  party: { id: ID; name: string; type: PartyType; currency?: string };
  period: { from: string; to: string };
  opening: number;
  closing: number;
  rows: PartyStatementRow[];
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
  costingMethod: "average" | "fifo";
  enforceCreditLimit: boolean;
  autoBackupEnabled: boolean;
  autoBackupFrequencyHours: number;
  autoBackupRetention: number;
  autoBackupFolder: string;
}

export interface BackupMeta {
  id: ID;
  name: string;
  createdAt: ISOString;
  size: number;
  type: "manual" | "auto";
  version: string;
}

export interface CurrencyRate {
  id: ID;
  code: string;
  name: string;
  symbol: string;
  rate: number;
  isBase?: boolean;
  createdAt?: ISOString;
  updatedAt?: ISOString;
}

export type PurchaseOrderStatus =
  | "draft"
  | "pending"
  | "approved"
  | "partially_received"
  | "received"
  | "cancelled";

export interface PurchaseOrderLine {
  id: ID;
  purchaseOrderId: ID;
  productId: ID;
  productName: string;
  description?: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: ID;
  number: string;
  supplierId: ID;
  supplierName?: string;
  warehouseId?: ID;
  warehouseName?: string;
  orderDate: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
  approvedBy?: ID;
  approvedAt?: string;
  createdBy?: ID;
  createdAt: ISOString;
  updatedAt: ISOString;
  lines: PurchaseOrderLine[];
  orderedQty?: number;
  receivedQty?: number;
  invoiceId?: ID;
}

export type DepreciationMethod = "straight-line" | "declining";
export type AssetStatus = "active" | "disposed" | "inactive";

export interface AssetDepreciationRun {
  id: ID;
  assetId: ID;
  period: string;
  amount: number;
  bookValueAfter: number;
  createdAt: ISOString;
  updatedAt: ISOString;
}

export interface Asset {
  id: ID;
  code: string;
  name: string;
  category?: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  currentValue: number;
  accumulatedDepreciation?: number;
  bookValue?: number;
  status: AssetStatus;
  accountId?: ID;
  accountName?: string;
  createdAt: ISOString;
  updatedAt: ISOString;
  runs?: AssetDepreciationRun[];
}

export interface AdvanceAllocation {
  id: ID;
  advanceId: ID;
  invoiceId: ID;
  invoiceNumber?: string;
  amount: number;
  allocatedAt: ISOString;
}

export interface CustomerAdvance {
  id: ID;
  partyId: ID;
  partyName?: string;
  amount: number;
  balance: number;
  currency: string;
  date: string;
  method?: string;
  reference?: string;
  notes?: string;
  createdAt: ISOString;
  updatedAt: ISOString;
  allocations?: AdvanceAllocation[];
}

export type AlertSeverity = "danger" | "warning" | "info";
export type AlertKind =
  | "low-stock"
  | "overdue-invoice"
  | "expiring-batch"
  | "recurring-due";

export interface AlertItem {
  id: ID;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;
  resource: string;
  resourceId?: ID;
  date?: string;
}

export interface AlertsSummary {
  lowStock: AlertItem[];
  overdueInvoices: AlertItem[];
  expiringBatches: AlertItem[];
  recurringDue: AlertItem[];
  counts: Record<string, number>;
  total: number;
}

export interface ImportRowResult {
  row: number;
  error?: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowResult[];
}

export interface SharePayload {
  type: "invoice" | "statement";
  id: ID;
}

export interface ShareLink {
  subject: string;
  body: string;
  mailto: string;
  whatsapp: string;
}

// ---- Payment Vouchers ----

export type PaymentVoucherType = "receipt" | "payment";
export type PaymentVoucherStatus = "draft" | "approved" | "cancelled";

export interface PaymentVoucher {
  id: ID;
  number: string;
  type: PaymentVoucherType;
  date: ISOString;
  partyId?: ID;
  partyName?: string;
  accountId: ID;
  accountName?: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  description?: string;
  status: PaymentVoucherStatus;
  createdBy: ID;
  createdAt: ISOString;
}

// ---- Sales Returns ----

export type SalesReturnStatus = "draft" | "issued" | "cancelled";

export interface SalesReturnLine {
  id: ID;
  productId: ID;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface SalesReturn {
  id: ID;
  number: string;
  customerId: ID;
  customerName?: string;
  invoiceId?: ID;
  invoiceNumber?: string;
  warehouseId?: ID;
  warehouseName?: string;
  returnDate: ISOString;
  lines: SalesReturnLine[];
  subtotal: number;
  tax: number;
  total: number;
  reason?: string;
  status: SalesReturnStatus;
  createdBy: ID;
  createdAt: ISOString;
}

// ---- Purchase Returns ----

export type PurchaseReturnStatus = "draft" | "issued" | "cancelled";

export interface PurchaseReturnLine {
  id: ID;
  productId: ID;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface PurchaseReturn {
  id: ID;
  number: string;
  supplierId: ID;
  supplierName?: string;
  invoiceId?: ID;
  invoiceNumber?: string;
  warehouseId?: ID;
  warehouseName?: string;
  returnDate: ISOString;
  lines: PurchaseReturnLine[];
  subtotal: number;
  tax: number;
  total: number;
  reason?: string;
  status: PurchaseReturnStatus;
  createdBy: ID;
  createdAt: ISOString;
}

// ---- Price Lists ----

export type PriceListStatus = "active" | "inactive";

export interface PriceListItem {
  id: ID;
  productId: ID;
  productName: string;
  price: number;
  minQuantity?: number;
}

export interface PriceList {
  id: ID;
  name: string;
  code: string;
  currency: string;
  items: PriceListItem[];
  status: PriceListStatus;
  notes?: string;
  createdBy: ID;
  createdAt: ISOString;
}

// ---- Delivery Notes ----

export type DeliveryNoteStatus = "pending" | "delivered" | "cancelled";

export interface DeliveryNoteLine {
  id: ID;
  productId: ID;
  productName: string;
  description?: string;
  quantity: number;
  deliveredQuantity: number;
}

export interface DeliveryNote {
  id: ID;
  number: string;
  orderId?: ID;
  orderNumber?: string;
  supplierId: ID;
  supplierName?: string;
  warehouseId: ID;
  warehouseName?: string;
  expectedDate: ISOString;
  receivedDate?: ISOString;
  lines: DeliveryNoteLine[];
  status: DeliveryNoteStatus;
  notes?: string;
  createdBy: ID;
  createdAt: ISOString;
}

// ---- Tax Reports ----

export interface TaxReportLine {
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface TaxReport {
  id: ID;
  period: { from: string; to: string };
  totalSales: number;
  totalPurchases: number;
  taxCollected: number;
  taxPaid: number;
  netTax: number;
  breakdown: TaxReportLine[];
}

// ---- Loyalty ----

export interface LoyaltyTransaction {
  id: ID;
  customerId: ID;
  customerName?: string;
  type: "earn" | "redeem";
  points: number;
  reference?: string;
  description?: string;
  createdAt: ISOString;
}

export interface LoyaltyAccount {
  id: ID;
  customerId: ID;
  customerName?: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  createdAt: ISOString;
  updatedAt: ISOString;
  transactions?: LoyaltyTransaction[];
}

// ---- Budgets ----

export interface Budget {
  id: ID;
  accountId: ID;
  accountCode?: string;
  accountName?: string;
  period: string;
  budgeted: number;
  actual: number;
  notes?: string;
  createdAt: ISOString;
  updatedAt: ISOString;
}

// ---- Landed Costs ----

export interface LandedCostLine {
  id: ID;
  description: string;
  amount: number;
}

export interface LandedCost {
  id: ID;
  purchaseInvoiceId: ID;
  purchaseInvoiceNumber?: string;
  totalAmount: number;
  allocationMethod: "value" | "quantity" | "weight";
  lines: LandedCostLine[];
  notes?: string;
  createdAt: ISOString;
  updatedAt: ISOString;
}

// ---- Barcodes ----

export interface BarcodeEntry {
  id: ID;
  productId: ID;
  productName?: string;
  sku?: string;
  barcode: string;
  format: "upc-a" | "ean-13" | "code-128" | "qr";
  createdAt: ISOString;
}

// ---- Stock Transfers ----

export type StockTransferStatus = "draft" | "pending" | "in_transit" | "completed" | "cancelled";

export interface StockTransferLine {
  id: ID;
  productId: ID;
  productName?: string;
  sku?: string;
  quantity: number;
  receivedQuantity?: number;
}

export interface StockTransfer {
  id: ID;
  number: string;
  fromWarehouseId: ID;
  fromWarehouseName?: string;
  toWarehouseId: ID;
  toWarehouseName?: string;
  status: StockTransferStatus;
  transferDate: ISOString;
  completedDate?: ISOString;
  lines: StockTransferLine[];
  notes?: string;
  createdBy: ID;
  createdAt: ISOString;
}

// ---- Serial Numbers ----

export type SerialNumberStatus = "available" | "sold" | "reserved" | "returned" | "defective";

export interface SerialNumber {
  id: ID;
  productId: ID;
  productName?: string;
  sku?: string;
  serialNumber: string;
  warehouseId?: ID;
  warehouseName?: string;
  status: SerialNumberStatus;
  invoiceId?: ID;
  invoiceNumber?: string;
  customerName?: string;
  soldAt?: ISOString;
  createdAt: ISOString;
}

// ---- Warranties ----

export type WarrantyStatus = "active" | "expired" | "claimed";

export interface Warranty {
  id: ID;
  productId: ID;
  productName?: string;
  customerId: ID;
  customerName?: string;
  serialNumber?: string;
  startDate: ISOString;
  endDate: ISOString;
  status: WarrantyStatus;
  terms?: string;
  claimDate?: ISOString;
  claimNotes?: string;
  createdAt: ISOString;
}

// ---- Profit Report ----

export interface ProfitReportItem {
  id: ID;
  productId: ID;
  productName: string;
  sku?: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

// ---- Payment Gateways ----

export type PaymentGatewayType = "stripe" | "paypal" | "square" | "paymob" | "other";

export type PaymentGatewayTransactionStatus = "pending" | "completed" | "failed" | "refunded";

export interface PaymentGatewayConfig {
  id: ID;
  name: string;
  type: PaymentGatewayType;
  isActive: boolean;
  apiKey?: string;
  merchantId?: string;
  sandboxMode: boolean;
  createdAt: ISOString;
}

export interface PaymentGatewayTransaction {
  id: ID;
  gatewayId: ID;
  gatewayName?: string;
  invoiceId?: ID;
  invoiceNumber?: string;
  customerName?: string;
  amount: number;
  currency: string;
  status: PaymentGatewayTransactionStatus;
  reference?: string;
  createdAt: ISOString;
}
