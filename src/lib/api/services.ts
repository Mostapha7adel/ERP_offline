import { api } from "./client";
import {
  mapParty,
  mapProduct,
  mapWarehouse,
  mapInvoice,
  mapQuote,
  mapRecurring,
  mapAccount,
  mapJournalEntry,
  mapTradeNote,
  mapFiscalYear,
  mapBankAccount,
  mapMoneyTransaction,
  mapUser,
  mapRole,
  mapAuditLog,
  mapNotification,
  mapCurrencyRate,
  mapPurchaseOrder,
  mapAsset,
  mapCustomerAdvance,
  mapPaymentVoucher,
  mapSalesReturn,
  mapPurchaseReturn,
  mapPriceList,
  mapDeliveryNote,
} from "./mappers";
import type {
  Party,
  Product,
  Warehouse,
  Invoice,
  Quote,
  RecurringInvoice,
  RecurringFrequency,
  TradeNote,
  FiscalYear,
  PartyStatement,
  Account,
  JournalEntry,
  BankAccount,
  MoneyTransaction,
  AppUser,
  AppRole,
  AppNotification,
  AuditLog,
  CurrencyRate,
  PurchaseOrder,
  Asset,
  CustomerAdvance,
  AlertsSummary,
  ImportResult,
  ShareLink,
  PaymentVoucher,
  SalesReturn,
  PurchaseReturn,
  PriceList,
  DeliveryNote,
  TaxReport,
  LoyaltyAccount,
  LoyaltyTransaction,
  Budget,
  LandedCost,
  BarcodeEntry,
  StockTransfer,
  SerialNumber,
  Warranty,
  ProfitReportItem,
  PaymentGatewayConfig,
  PaymentGatewayTransaction,
  GeneralLedgerReport,
  PurchaseBySupplier,
  PurchaseByCategory,
  PurchaseTrend,
  CurrencyGainLossItem,
  PeriodComparisonReport,
  BranchProfitItem,
  CustomReport,
  ScheduledReport,
  PeriodClose,
} from "@/types/domain";

// ---- Auth ----

export interface LoginPayload {
  email: string;
  password: string;
}

export interface Principal {
  sub: string;
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  mustChangePassword?: boolean;
  needsSetup?: boolean;
  user: Principal;
}

export function authApi() {
  return {
    login(payload: LoginPayload): Promise<LoginResult> {
      return api.post<LoginResult>("/auth/login", payload);
    },
    me(): Promise<Principal> {
      return api.get<Principal>("/auth/me");
    },
    refresh(refreshToken: string): Promise<LoginResult> {
      // skipAuthRefresh is critical: without it a 401 here (expired refresh
      // token) would re-enter the refresh flow and deadlock on itself.
      return api.post<LoginResult>("/auth/refresh", { refreshToken }, { skipAuthRefresh: true });
    },
    logout(refreshToken: string): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/auth/logout", { refreshToken }, { skipAuthRefresh: true });
    },
    changePassword(
      newPassword: string,
      email?: string,
    ): Promise<{ success: boolean; email: string; accessToken: string }> {
      return api.post<{ success: boolean; email: string; accessToken: string }>("/auth/change-password", {
        newPassword,
        email,
      });
    },
    completeSetup(): Promise<{ success: boolean; accessToken: string }> {
      return api.post<{ success: boolean; accessToken: string }>("/auth/complete-setup", {});
    },
    forgotPassword(email: string, newPassword: string): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/auth/forgot-password", { email, newPassword });
    },
  };
}

// ---- Parties ----

type PartyType = "customer" | "supplier";

export interface PartyInput {
  type: PartyType;
  name: string;
  code?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  creditLimit?: number;
  currency?: string;
  notes?: string;
  status?: "active" | "inactive";
}

export function partiesApi() {
  const base = (type: PartyType) => (type === "customer" ? "/customers" : "/suppliers");

  return {
    async list(type: PartyType): Promise<Party[]> {
      const res = await api.getList<Parameters<typeof mapParty>[0]>(
        `${base(type)}?limit=100`,
      );
      return res.data.map(mapParty);
    },
    create(type: PartyType, input: Omit<PartyInput, "type">): Promise<Party> {
      return api
        .post<Parameters<typeof mapParty>[0]>(base(type), input)
        .then(mapParty);
    },
    update(id: string, input: Partial<Omit<PartyInput, "type">>): Promise<Party> {
      return api
        .put<Parameters<typeof mapParty>[0]>(`/customers/${id}`, input)
        .then(mapParty)
        .catch(() =>
          api
            .put<Parameters<typeof mapParty>[0]>(`/suppliers/${id}`, input)
            .then(mapParty),
        );
    },
    remove(id: string): Promise<{ id: string }> {
      return api
        .delete<{ id: string }>(`/customers/${id}`)
        .catch(() => api.delete<{ id: string }>(`/suppliers/${id}`));
    },
  };
}

// ---- Products ----

export interface ProductInput {
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
  taxRate?: number;
  trackStock?: boolean;
  reorderLevel?: number;
  status?: "active" | "draft" | "archived";
}

export function productsApi() {
  return {
    async list(): Promise<Product[]> {
      const res = await api.getList<Parameters<typeof mapProduct>[0]>(
        "/products?limit=100",
      );
      return res.data.map(mapProduct);
    },
    create(input: ProductInput): Promise<Product> {
      return api
        .post<Parameters<typeof mapProduct>[0]>("/products", input)
        .then(mapProduct);
    },
    update(id: string, input: Partial<ProductInput>): Promise<Product> {
      return api
        .put<Parameters<typeof mapProduct>[0]>(`/products/${id}`, input)
        .then(mapProduct);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/products/${id}`);
    },
  };
}

// ---- Warehouses ----

export interface WarehouseInput {
  code?: string;
  name: string;
  address?: string;
  manager?: string;
  phone?: string;
  isDefault?: boolean;
  status?: "active" | "inactive";
}

export function warehousesApi() {
  return {
    async list(): Promise<Warehouse[]> {
      const res = await api.getList<Parameters<typeof mapWarehouse>[0]>(
        "/warehouses?limit=100",
      );
      return res.data.map(mapWarehouse);
    },
    create(input: WarehouseInput): Promise<Warehouse> {
      return api
        .post<Parameters<typeof mapWarehouse>[0]>("/warehouses", input)
        .then(mapWarehouse);
    },
    update(id: string, input: Partial<WarehouseInput>): Promise<Warehouse> {
      return api
        .put<Parameters<typeof mapWarehouse>[0]>(`/warehouses/${id}`, input)
        .then(mapWarehouse);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/warehouses/${id}`);
    },
  };
}

// ---- Inventory ----

export interface StockRow {
  id: string;
  productId: string;
  warehouseId: string;
  quantityOnHand: number;
  reservedQuantity: number;
  reorderLevel: number;
  averageCost: number;
  productName?: string;
  sku?: string;
  warehouseName?: string;
  stockValue: number;
  isLowStock: boolean;
}

export interface StockMovementRow {
  id: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: number;
  reference?: string;
  referenceId?: string;
  note?: string;
  cost: number;
  createdBy: string;
  createdAt: string;
  productName?: string;
  sku?: string;
  warehouseName?: string;
}

export interface AdjustmentInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason: string;
  note?: string;
}

export interface TransferItem {
  productId: string;
  quantity: number;
}

export interface TransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: TransferItem[];
  note?: string;
}

export function inventoryApi() {
  return {
    async list(query?: { warehouseId?: string }): Promise<StockRow[]> {
      const res = await api.getList<StockRow>("/inventory?limit=100", {
        query: query?.warehouseId ? { warehouseId: query.warehouseId } : undefined,
      });
      return res.data;
    },
    async lowStock(): Promise<StockRow[]> {
      return api.get<StockRow[]>("/inventory/low-stock");
    },
    async movements(): Promise<StockMovementRow[]> {
      const res = await api.getList<StockMovementRow>(
        "/inventory/movements?limit=100",
      );
      return res.data;
    },
    adjust(input: AdjustmentInput): Promise<{ success: boolean; newQuantity: number }> {
      return api.post<{ success: boolean; newQuantity: number }>(
        "/inventory/adjustments",
        input,
      );
    },
    transfer(input: TransferInput): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/inventory/transfers", input);
    },
    async batches(query?: { productId?: string; warehouseId?: string }): Promise<BatchRow[]> {
      return api.get<BatchRow[]>("/inventory/batches", {
        query: query as Record<string, string | number | boolean> | undefined,
      });
    },
    recordBatch(input: {
      productId: string;
      warehouseId: string;
      batchNumber: string;
      quantity: number;
      expiryDate?: string;
    }): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/inventory/batches", input);
    },
  };
}

export interface BatchRow {
  id: string;
  productId: string;
  warehouseId: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string;
  receivedAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  productName?: string;
  sku?: string;
  warehouseName?: string;
}

// ---- Invoices (sales & purchases) ----

export interface InvoiceLineInput {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface InvoiceInput {
  type: "sales" | "purchase";
  customerId?: string;
  supplierId?: string;
  invoiceDate: string;
  dueDate?: string;
  warehouseId?: string;
  lines: InvoiceLineInput[];
  discount?: number;
  paymentMethod?: string;
  paidNow?: boolean;
  paymentAccountId?: string;
  received?: boolean;
  notes?: string;
}

export interface PaymentInput {
  amount: number;
  method?: string;
  accountId?: string;
}

export interface QuoteLineInput {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface QuoteInput {
  type: "sales" | "purchase";
  partyId: string;
  quoteDate: string;
  validUntil?: string;
  warehouseId?: string;
  lines: QuoteLineInput[];
  discount?: number;
  notes?: string;
}

export interface RecurringInput {
  type: "sales" | "purchase";
  partyId: string;
  warehouseId?: string;
  frequency: RecurringFrequency;
  interval: number;
  nextRunDate: string;
  isActive?: boolean;
  lines: QuoteLineInput[];
  discount?: number;
  notes?: string;
}

export function invoicesApi() {
  const base = (kind: "sale" | "purchase") =>
    kind === "sale" ? "/sales" : "/purchases";
  const partyKey = (kind: "sale" | "purchase") =>
    kind === "sale" ? "customerId" : "supplierId";

  return {
    async list(kind: "sale" | "purchase"): Promise<Invoice[]> {
      const res = await api.getList<Parameters<typeof mapInvoice>[0]>(
        `${base(kind)}?limit=100`,
      );
      return res.data.map(mapInvoice);
    },
    async get(kind: "sale" | "purchase", id: string): Promise<Invoice> {
      const invoice = await api.get<Parameters<typeof mapInvoice>[0]>(
        `${base(kind)}/${id}`,
      );
      return mapInvoice(invoice);
    },
    create(kind: "sale" | "purchase", input: InvoiceInput): Promise<Invoice> {
      const payload: Record<string, unknown> = { ...input };
      delete payload.customerId;
      delete payload.supplierId;
      if (kind === "sale") {
        payload.customerId = input.customerId;
      } else {
        payload.supplierId = input.supplierId;
      }
      return api
        .post<Parameters<typeof mapInvoice>[0]>(base(kind), payload)
        .then(mapInvoice);
    },
    update(
      kind: "sale" | "purchase",
      id: string,
      input: Partial<InvoiceInput> & { status?: "draft" | "issued" | "partial" | "paid" | "void" },
    ): Promise<Invoice> {
      return api
        .patch<Parameters<typeof mapInvoice>[0]>(`${base(kind)}/${id}`, input)
        .then(mapInvoice);
    },
    registerPayment(
      kind: "sale" | "purchase",
      id: string,
      input: PaymentInput,
    ): Promise<Invoice> {
      return api
        .post<Parameters<typeof mapInvoice>[0]>(
          `${base(kind)}/${id}/pay`,
          input,
        )
        .then(mapInvoice);
    },
    receivePurchase(
      id: string,
      input?: { warehouseId?: string },
    ): Promise<Invoice> {
      return api
        .post<Parameters<typeof mapInvoice>[0]>(
          `/purchases/${id}/receive`,
          input,
        )
        .then(mapInvoice);
    },
    void(kind: "sale" | "purchase", id: string): Promise<Invoice> {
      return api
        .post<Parameters<typeof mapInvoice>[0]>(`${base(kind)}/${id}/void`)
        .then(mapInvoice);
    },
    partyKey,
  };
}

// ---- Treasury ----

export interface TreasuryAccountInput {
  name: string;
  type: "cash" | "bank" | "credit-card" | "paypal" | "other";
  currency?: string;
  openingBalance?: number;
  notes?: string;
  isActive?: boolean;
}

export interface TreasuryTransactionInput {
  accountId: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  partyType?: string;
  partyId?: string;
  reference?: string;
  description?: string;
  date?: string;
}

export interface TreasuryTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  description?: string;
}

export function treasuryApi() {
  return {
    async accounts(): Promise<BankAccount[]> {
      const res = await api.getList<Parameters<typeof mapBankAccount>[0]>(
        "/treasury/accounts?limit=100",
      );
      return res.data.map(mapBankAccount);
    },
    createAccount(input: TreasuryAccountInput): Promise<BankAccount> {
      return api
        .post<Parameters<typeof mapBankAccount>[0]>("/treasury/accounts", input)
        .then(mapBankAccount);
    },
    updateAccount(
      id: string,
      input: Partial<TreasuryAccountInput>,
    ): Promise<BankAccount> {
      return api
        .put<Parameters<typeof mapBankAccount>[0]>(
          `/treasury/accounts/${id}`,
          input,
        )
        .then(mapBankAccount);
    },
    removeAccount(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/treasury/accounts/${id}`);
    },
    async transactions(): Promise<MoneyTransaction[]> {
      const res = await api.getList<Parameters<typeof mapMoneyTransaction>[0]>(
        "/treasury/transactions?limit=100",
      );
      return res.data.map(mapMoneyTransaction);
    },
    createTransaction(
      input: TreasuryTransactionInput,
    ): Promise<MoneyTransaction> {
      return api
        .post<Parameters<typeof mapMoneyTransaction>[0]>(
          "/treasury/transactions",
          input,
        )
        .then(mapMoneyTransaction);
    },
    removeTransaction(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/treasury/transactions/${id}`);
    },
    transfer(input: TreasuryTransferInput): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/treasury/transfers", input);
    },
  };
}

// ---- Accounting ----

export interface AccountInput {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  category: string;
  isActive?: boolean;
  openingBalance?: number;
  parentCode?: string;
}

export interface JournalLineInput {
  accountCode: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalInput {
  date: string;
  memo?: string;
  lines: JournalLineInput[];
}

export function accountingApi() {
  return {
    async accounts(): Promise<Account[]> {
      const res = await api.getList<Parameters<typeof mapAccount>[0]>(
        "/accounting/chart?limit=100",
      );
      return res.data.map(mapAccount);
    },
    createAccount(input: AccountInput): Promise<Account> {
      return api
        .post<Parameters<typeof mapAccount>[0]>("/accounting/accounts", input)
        .then(mapAccount);
    },
    updateAccount(id: string, input: Partial<AccountInput>): Promise<Account> {
      return api
        .put<Parameters<typeof mapAccount>[0]>(
          `/accounting/accounts/${id}`,
          input,
        )
        .then(mapAccount);
    },
    removeAccount(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/accounting/accounts/${id}`);
    },
    async journals(): Promise<{ entries: JournalEntry[]; accountsByCode: Map<string, string> }> {
      const [res, accounts] = await Promise.all([
        api.getList<Parameters<typeof mapJournalEntry>[0]>(
          "/accounting/journals?limit=100",
        ),
        accountingApi().accounts(),
      ]);
      const accountsByCode = new Map(accounts.map((a) => [a.code, a.id]));
      return {
        entries: res.data.map((j) => mapJournalEntry(j, accountsByCode)),
        accountsByCode,
      };
    },
    createJournal(input: JournalInput): Promise<JournalEntry> {
      return api
        .post<Parameters<typeof mapJournalEntry>[0]>("/accounting/journals", input)
        .then((j) => mapJournalEntry(j, new Map()));
    },
    voidJournal(id: string): Promise<JournalEntry> {
      return api
        .post<Parameters<typeof mapJournalEntry>[0]>(
          `/accounting/journals/${id}/void`,
        )
        .then((j) => mapJournalEntry(j, new Map()));
    },
  };
}

// ---- Credit / Debit notes ----

export interface NoteLineInput {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface NoteInput {
  type: "sales" | "purchase";
  noteType: "credit" | "debit";
  invoiceId?: string;
  partyId?: string;
  warehouseId?: string;
  noteDate: string;
  lines: NoteLineInput[];
  discount?: number;
  reason?: string;
  notes?: string;
}

export function notesApi() {
  return {
    async list(): Promise<TradeNote[]> {
      const res = await api.getList<Parameters<typeof mapTradeNote>[0]>(
        "/notes?limit=100",
      );
      return res.data.map(mapTradeNote);
    },
    async get(id: string): Promise<TradeNote> {
      const note = await api.get<Parameters<typeof mapTradeNote>[0]>(`/notes/${id}`);
      return mapTradeNote(note);
    },
    create(input: NoteInput): Promise<TradeNote> {
      return api
        .post<Parameters<typeof mapTradeNote>[0]>("/notes", input)
        .then(mapTradeNote);
    },
    void(id: string): Promise<TradeNote> {
      return api
        .post<Parameters<typeof mapTradeNote>[0]>(`/notes/${id}/void`)
        .then(mapTradeNote);
    },
  };
}

// ---- Fiscal years ----

export interface FiscalYearInput {
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface FiscalYearBalances {
  fiscalYears: FiscalYear[];
}

export function fiscalYearApi() {
  return {
    async list(): Promise<FiscalYear[]> {
      const res = await api.get<Parameters<typeof mapFiscalYear>[0][]>(
        "/accounting/fiscal-years",
      );
      return (res ?? []).map(mapFiscalYear);
    },
    create(input: FiscalYearInput): Promise<FiscalYear> {
      return api
        .post<Parameters<typeof mapFiscalYear>[0]>("/accounting/fiscal-years", input)
        .then(mapFiscalYear);
    },
    close(id: string): Promise<FiscalYear> {
      return api
        .post<Parameters<typeof mapFiscalYear>[0]>(`/accounting/fiscal-years/${id}/close`)
        .then(mapFiscalYear);
    },
  };
}

// ---- Users & Roles ----

export interface UserInput {
  name: string;
  email: string;
  password?: string;
  roleId: string;
  status?: "active" | "inactive";
  phone?: string;
  jobTitle?: string;
  avatarUrl?: string;
}

export interface RoleInput {
  name: string;
  description?: string;
  avatarUrl?: string;
  permissions: string[];
}

export interface ProfileInput {
  name?: string;
  phone?: string;
  jobTitle?: string;
  avatarUrl?: string;
}

export function usersApi() {
  return {
    async list(): Promise<AppUser[]> {
      const res = await api.getList<Parameters<typeof mapUser>[0]>(
        "/users?limit=100",
      );
      return res.data.map(mapUser);
    },
    create(input: UserInput): Promise<AppUser> {
      return api
        .post<Parameters<typeof mapUser>[0]>("/users", input)
        .then(mapUser);
    },
    update(id: string, input: Partial<UserInput>): Promise<AppUser> {
      return api
        .put<Parameters<typeof mapUser>[0]>(`/users/${id}`, input)
        .then(mapUser);
    },
    resetPassword(id: string, password: string): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>(`/users/${id}/reset-password`, { password });
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/users/${id}`);
    },
    updateProfile(input: ProfileInput): Promise<AppUser> {
      return api
        .put<Parameters<typeof mapUser>[0]>("/users/me", input)
        .then(mapUser);
    },
  };
}

export function rolesApi() {
  return {
    async list(): Promise<AppRole[]> {
      const res = await api.getList<Parameters<typeof mapRole>[0]>(
        "/roles?limit=100",
      );
      return res.data.map(mapRole);
    },
    create(input: RoleInput): Promise<AppRole> {
      return api.post<Parameters<typeof mapRole>[0]>("/roles", input).then(mapRole);
    },
    update(id: string, input: Partial<RoleInput>): Promise<AppRole> {
      return api
        .put<Parameters<typeof mapRole>[0]>(`/roles/${id}`, input)
        .then(mapRole);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/roles/${id}`);
    },
  };
}

// ---- Audit ----

export function auditApi() {
  return {
    async list(): Promise<AuditLog[]> {
      const res = await api.getList<Parameters<typeof mapAuditLog>[0]>(
        "/audit-logs?limit=100",
      );
      return res.data.map(mapAuditLog);
    },
  };
}

// ---- Notifications ----

export function notificationsApi() {
  return {
    async list(): Promise<AppNotification[]> {
      const res = await api.getList<Parameters<typeof mapNotification>[0]>(
        "/notifications?limit=60",
      );
      return res.data.map(mapNotification);
    },
    markRead(id: string): Promise<AppNotification> {
      return api
        .post<Parameters<typeof mapNotification>[0]>(
          `/notifications/${id}/read`,
          {},
        )
        .then(mapNotification);
    },
    markAllRead(): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/notifications/read-all", {});
    },
  };
}

// ---- Backup ----

export interface BackupRecord {
  id: string;
  label: string;
  createdAt: string;
  sizeBytes: number;
  recordCount: number;
}

export interface BackupDownload {
  app: string;
  version: number;
  createdAt: string;
  data: Record<string, unknown[]>;
}

export function backupApi() {
  return {
    async list(): Promise<BackupRecord[]> {
      const res = await api.getList<BackupRecord>("/backup?limit=50");
      return res.data;
    },
    create(label?: string): Promise<BackupRecord> {
      return api.post<BackupRecord>("/backup", label ? { label } : {});
    },
    download(id: string): Promise<BackupDownload> {
      return api.getRaw<BackupDownload>(`/backup/${id}/download`);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/backup/${id}`);
    },
    restoreFromBackup(backupId: string): Promise<{ restored: number }> {
      return api.post<{ restored: number }>("/restore/from-backup", { backupId });
    },
    restoreFromPayload(data: unknown): Promise<{ restored: number }> {
      return api.post<{ restored: number }>("/restore/from-payload", { data });
    },
    resetWorkspace(): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/reset/workspace");
    },
  };
}

// ---- Settings ----

export interface CompanySettings {
  name: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  currency: string;
  fiscalYearStart: string;
  logoUrl?: string;
}

export interface PreferencesSettings {
  defaultWarehouseId?: string;
  lowStockThreshold: number;
  invoicePrefix: string;
  purchasePrefix: string;
  taxEnabled: boolean;
  defaultTaxRate: number;
  dateFormat: string;
  notifyOnLowStock: boolean;
  notifyOnInvoiceCreated: boolean;
  costingMethod?: "average" | "fifo";
  enforceCreditLimit?: boolean;
  autoBackupEnabled?: boolean;
  autoBackupFrequencyHours?: number;
  autoBackupRetention?: number;
  autoBackupFolder?: string;
}

export interface SettingsBundle {
  company: CompanySettings;
  preferences: PreferencesSettings;
}

export function settingsApi() {
  return {
    async getAll(): Promise<SettingsBundle> {
      return api.get<SettingsBundle>("/settings");
    },
    updateAll(
      input: { company?: Partial<CompanySettings>; preferences?: Partial<PreferencesSettings> },
    ): Promise<SettingsBundle> {
      return api.put<SettingsBundle>("/settings", input);
    },
    updateCompany(input: Partial<CompanySettings>): Promise<CompanySettings> {
      return api.put<CompanySettings>("/settings/company", input);
    },
    updatePreferences(
      input: Partial<PreferencesSettings>,
    ): Promise<PreferencesSettings> {
      return api.put<PreferencesSettings>("/settings/preferences", input);
    },
  };
}


// ---- Reports ----

export interface ReportRange {
  from?: string;
  to?: string;
}

export interface ProfitLossReport {
  period: { from: string; to: string };
  revenue: number;
  taxCollected: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  netProfit: number;
}

export interface CashFlowReport {
  period: { from: string; to: string };
  inflows: number;
  outflows: number;
  net: number;
  totalCashBalance: number;
  byCategory: Array<{ category: string; type: string; amount: number }>;
}

export interface SalesReport {
  period: { from: string; to: string };
  summary: { count: number; totalRevenue: number; totalTax: number; averageInvoice: number };
  topProducts: Array<{ productId?: string; name: string; quantity: number; revenue: number }>;
  byCustomer: Array<{ name: string; count: number; total: number }>;
}

export interface InventoryValuationRow {
  productId: string;
  sku?: string;
  name?: string;
  quantityOnHand: number;
  averageCost: number;
  value: number;
  isLowStock: boolean;
}

export interface InventoryValuationReport {
  totalValue: number;
  totalUnits: number;
  items: InventoryValuationRow[];
}

export interface AgingReport {
  type: "receivable" | "payable";
  buckets: Record<string, number>;
  total: number;
  rows: Array<{
    invoiceId: string;
    number: string;
    partyName: string;
    invoiceDate: string;
    dueDate?: string;
    total: number;
    paidAmount: number;
    balance: number;
    bucket: string;
  }>;
}

export interface BalanceSheetReport {
  sections: {
    assets: { label: string; rows: Array<{ code: string; name: string; balance: number }>; total: number };
    liabilities: { label: string; rows: Array<{ code: string; name: string; balance: number }>; total: number };
    equity: { label: string; rows: Array<{ code: string; name: string; balance: number }>; total: number };
  };
  retainedEarnings: number;
  netProfit: number;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

export interface CustomerLedgerReport {
  customers: Array<{
    customerId: string;
    name: string;
    open: number;
    paid: number;
    invoices: Array<{
      id: string;
      number: string;
      invoiceDate: string;
      dueDate?: string;
      total: number;
      paidAmount: number;
      balance: number;
      status: string;
    }>;
  }>;
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

export function reportsApi() {
  return {
    profitLoss(range?: ReportRange): Promise<ProfitLossReport> {
      return api.get<ProfitLossReport>("/reports/profit-loss", { query: range ? { ...range } : undefined });
    },
    cashFlow(range?: ReportRange): Promise<CashFlowReport> {
      return api.get<CashFlowReport>("/reports/cash-flow", { query: range ? { ...range } : undefined });
    },
    sales(range?: ReportRange): Promise<SalesReport> {
      return api.get<SalesReport>("/reports/sales", { query: range ? { ...range } : undefined });
    },
    inventoryValuation(warehouseId?: string): Promise<InventoryValuationReport> {
      return api.get<InventoryValuationReport>("/reports/inventory-valuation", {
        query: warehouseId ? { warehouseId } : undefined,
      });
    },
    aging(type: "receivable" | "payable"): Promise<AgingReport> {
      return api.get<AgingReport>("/reports/aging", { query: { type } });
    },
    balanceSheet(): Promise<BalanceSheetReport> {
      return api.get<BalanceSheetReport>("/reports/balance-sheet");
    },
    customerLedger(customerId?: string): Promise<CustomerLedgerReport> {
      return api.get<CustomerLedgerReport>("/reports/customer-ledger", { query: { customerId } });
    },
    trialBalance(): Promise<TrialBalanceReport> {
      return api.get<TrialBalanceReport>("/accounting/trial-balance");
    },
    trialBalanceForFiscalYear(fiscalYearId: string): Promise<TrialBalanceReport> {
      return api.get<TrialBalanceReport>("/accounting/trial-balance", { query: { fiscalYearId } });
    },
    partyStatement(partyId: string, range?: ReportRange): Promise<PartyStatement> {
      return api.get<PartyStatement>("/reports/party-statement", {
        query: { partyId, ...(range?.from ? { from: range.from } : {}), ...(range?.to ? { to: range.to } : {}) },
      });
    },
  };
}

// ---- Network (LAN workspace) ----

export interface NetworkStatus {
  app: string;
  mode: string;
  workspaceReady: boolean;
  serverTime: string;
  hostIps: string[];
  port: number;
}

export interface NetworkWorkspace {
  id: string;
  name: string;
  joinCode: string;
  hostDeviceId: string | null;
  createdAt: string;
}

export interface NetworkDevice {
  id: string;
  deviceId: string;
  name: string;
  ip?: string;
  currentUserName?: string;
  isHost: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export interface NetworkJoinResult {
  workspaceName: string;
  deviceId: string;
  token: string;
  /** Host's per-install app secret; echoed back as `x-app-token` on host API calls. */
  appSecret?: string;
}

export interface NetworkCreateResult extends NetworkWorkspace {
  token: string;
}

export function networkApi() {
  return {
    status(): Promise<NetworkStatus> {
      return api.get<NetworkStatus>("/network/status");
    },
    createWorkspace(input: { name: string; deviceId: string; deviceName: string }): Promise<NetworkCreateResult> {
      return api.post<NetworkCreateResult>("/network/workspace", input);
    },
    getWorkspace(): Promise<NetworkWorkspace> {
      return api.get<NetworkWorkspace>("/network/workspace");
    },
    deleteWorkspace(): Promise<{ success: boolean }> {
      return api.delete<{ success: boolean }>("/network/workspace");
    },
    join(input: { code: string; deviceId: string; deviceName: string }): Promise<NetworkJoinResult> {
      return api.post<NetworkJoinResult>("/network/join", input);
    },
    heartbeat(input: { token: string; deviceId: string; deviceName: string; currentUserName?: string; isHost?: boolean }): Promise<{ ok: boolean; serverTime: string }> {
      return api.post<{ ok: boolean; serverTime: string }>("/network/heartbeat", input);
    },
    listDevices(): Promise<NetworkDevice[]> {
      return api.get<NetworkDevice[]>("/network/devices");
    },
    kick(deviceId: string): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/network/kick", { deviceId });
    },
  };
}

export function quotesApi() {
  const base = (kind: "sale" | "purchase") =>
    kind === "sale" ? "/quotes/sales" : "/quotes/purchases";

  return {
    async list(kind: "sale" | "purchase"): Promise<Quote[]> {
      const res = await api.getList<Parameters<typeof mapQuote>[0]>(
        `${base(kind)}?limit=100`,
      );
      return res.data.map(mapQuote);
    },
    async get(kind: "sale" | "purchase", id: string): Promise<Quote> {
      const quote = await api.get<Parameters<typeof mapQuote>[0]>(
        `${base(kind)}/${id}`,
      );
      return mapQuote(quote);
    },
    create(kind: "sale" | "purchase", input: QuoteInput): Promise<Quote> {
      return api
        .post<Parameters<typeof mapQuote>[0]>(base(kind), input)
        .then(mapQuote);
    },
    update(kind: "sale" | "purchase", id: string, input: Partial<QuoteInput>): Promise<Quote> {
      return api
        .patch<Parameters<typeof mapQuote>[0]>(`${base(kind)}/${id}`, input)
        .then(mapQuote);
    },
    async convert(kind: "sale" | "purchase", id: string): Promise<{ quote: Quote; invoiceId: string }> {
      const res = await api.post<{ quote: Parameters<typeof mapQuote>[0]; invoiceId: string }>(
        `${base(kind)}/${id}/convert`,
        {},
      );
      return { quote: mapQuote(res.quote), invoiceId: res.invoiceId };
    },
    remove(kind: "sale" | "purchase", id: string): Promise<{ success: boolean }> {
      return api.delete<{ success: boolean }>(`${base(kind)}/${id}`);
    },
  };
}

export function recurringApi() {
  const base = (kind: "sale" | "purchase") =>
    kind === "sale" ? "/recurring/sales" : "/recurring/purchases";

  return {
    async list(kind: "sale" | "purchase"): Promise<RecurringInvoice[]> {
      const res = await api.getList<Parameters<typeof mapRecurring>[0]>(
        `${base(kind)}?limit=100`,
      );
      return res.data.map(mapRecurring);
    },
    async get(kind: "sale" | "purchase", id: string): Promise<RecurringInvoice> {
      const recurring = await api.get<Parameters<typeof mapRecurring>[0]>(
        `${base(kind)}/${id}`,
      );
      return mapRecurring(recurring);
    },
    create(kind: "sale" | "purchase", input: RecurringInput): Promise<RecurringInvoice> {
      return api
        .post<Parameters<typeof mapRecurring>[0]>(base(kind), input)
        .then(mapRecurring);
    },
    update(kind: "sale" | "purchase", id: string, input: Partial<RecurringInput>): Promise<RecurringInvoice> {
      return api
        .patch<Parameters<typeof mapRecurring>[0]>(`${base(kind)}/${id}`, input)
        .then(mapRecurring);
    },
    run(kind: "sale" | "purchase"): Promise<{ generated: number; invoices: string[] }> {
      return api.post<{ generated: number; invoices: string[] }>(
        `${base(kind)}/run`,
        {},
      );
    },
    remove(kind: "sale" | "purchase", id: string): Promise<{ success: boolean }> {
      return api.delete<{ success: boolean }>(`${base(kind)}/${id}`);
    },
  };
}

// ---- Currencies ----

export interface CurrencyInput {
  code: string;
  name?: string;
  symbol?: string;
  rate: number;
  isBase?: boolean;
}

export function currenciesApi() {
  return {
    async list(): Promise<CurrencyRate[]> {
      const res = await api.get<Parameters<typeof mapCurrencyRate>[0][]>(
        "/currencies",
      );
      return (res ?? []).map(mapCurrencyRate);
    },
    create(input: CurrencyInput): Promise<CurrencyRate> {
      return api
        .post<Parameters<typeof mapCurrencyRate>[0]>("/currencies", input)
        .then(mapCurrencyRate);
    },
    update(id: string, input: Partial<CurrencyInput>): Promise<CurrencyRate> {
      return api
        .patch<Parameters<typeof mapCurrencyRate>[0]>(
          `/currencies/${id}`,
          input,
        )
        .then(mapCurrencyRate);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/currencies/${id}`);
    },
  };
}

// ---- Purchase orders ----

export interface PurchaseOrderLineInput {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface PurchaseOrderInput {
  supplierId?: string;
  warehouseId?: string;
  orderDate: string;
  expectedDate?: string;
  lines: PurchaseOrderLineInput[];
  discount?: number;
  currency?: string;
  notes?: string;
}

export function purchaseOrdersApi() {
  return {
    async list(query?: { status?: string; search?: string }): Promise<PurchaseOrder[]> {
      const res = await api.getList<Parameters<typeof mapPurchaseOrder>[0]>(
        "/purchase-orders?limit=100",
        { query: query as Record<string, string | number | boolean> | undefined },
      );
      return res.data.map(mapPurchaseOrder);
    },
    async get(id: string): Promise<PurchaseOrder> {
      const po = await api.get<Parameters<typeof mapPurchaseOrder>[0]>(
        `/purchase-orders/${id}`,
      );
      return mapPurchaseOrder(po);
    },
    create(input: PurchaseOrderInput): Promise<PurchaseOrder> {
      return api
        .post<Parameters<typeof mapPurchaseOrder>[0]>("/purchase-orders", input)
        .then(mapPurchaseOrder);
    },
    update(id: string, input: Partial<PurchaseOrderInput>): Promise<PurchaseOrder> {
      return api
        .patch<Parameters<typeof mapPurchaseOrder>[0]>(
          `/purchase-orders/${id}`,
          input,
        )
        .then(mapPurchaseOrder);
    },
    submit(id: string): Promise<PurchaseOrder> {
      return api
        .post<Parameters<typeof mapPurchaseOrder>[0]>(
          `/purchase-orders/${id}/submit`,
          {},
        )
        .then(mapPurchaseOrder);
    },
    approve(id: string): Promise<PurchaseOrder> {
      return api
        .post<Parameters<typeof mapPurchaseOrder>[0]>(
          `/purchase-orders/${id}/approve`,
          {},
        )
        .then(mapPurchaseOrder);
    },
    cancel(id: string): Promise<PurchaseOrder> {
      return api
        .post<Parameters<typeof mapPurchaseOrder>[0]>(
          `/purchase-orders/${id}/cancel`,
          {},
        )
        .then(mapPurchaseOrder);
    },
    receive(
      id: string,
      quantities?: Record<string, number>,
    ): Promise<PurchaseOrder & { invoiceId?: string }> {
      return api
        .post<Parameters<typeof mapPurchaseOrder>[0] & { invoiceId?: string }>(
          `/purchase-orders/${id}/receive`,
          quantities ? { quantities } : {},
        )
        .then((po) => ({ ...mapPurchaseOrder(po), invoiceId: po.invoiceId }));
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/purchase-orders/${id}`);
    },
  };
}

// ---- Fixed assets ----

export interface AssetInput {
  code: string;
  name: string;
  category?: string;
  purchaseDate?: string;
  cost?: number;
  salvageValue?: number;
  usefulLifeMonths: number;
  depreciationMethod?: "straight-line" | "declining";
  accountId?: string;
  accumulatedDepreciationAccountId?: string;
  depreciationExpenseAccountId?: string;
  status?: "active" | "disposed" | "writtenOff";
  notes?: string;
}

export function assetsApi() {
  return {
    async list(): Promise<Asset[]> {
      const res = await api.getList<Parameters<typeof mapAsset>[0]>(
        "/assets?limit=100",
      );
      return res.data.map(mapAsset);
    },
    async get(id: string): Promise<Asset> {
      const asset = await api.get<Parameters<typeof mapAsset>[0]>(`/assets/${id}`);
      return mapAsset(asset);
    },
    create(input: AssetInput): Promise<Asset> {
      return api
        .post<Parameters<typeof mapAsset>[0]>("/assets", input)
        .then(mapAsset);
    },
    update(id: string, input: Partial<AssetInput>): Promise<Asset> {
      return api
        .patch<Parameters<typeof mapAsset>[0]>(`/assets/${id}`, input)
        .then(mapAsset);
    },
    depreciate(id: string, period?: string): Promise<Asset & { run?: unknown }> {
      return api
        .post<Parameters<typeof mapAsset>[0] & { run?: unknown }>(
          `/assets/${id}/depreciate`,
          period ? { period } : {},
        )
        .then((asset) => ({ ...mapAsset(asset), run: asset.run }));
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/assets/${id}`);
    },
  };
}

// ---- Customer advances ----

export interface AdvanceInput {
  partyId: string;
  amount: number;
  currency?: string;
  date: string;
  method?: string;
  reference?: string;
  notes?: string;
}

export function advancesApi() {
  return {
    async list(): Promise<CustomerAdvance[]> {
      const res = await api.getList<Parameters<typeof mapCustomerAdvance>[0]>(
        "/advances?limit=100",
      );
      return res.data.map(mapCustomerAdvance);
    },
    async get(id: string): Promise<CustomerAdvance> {
      const advance = await api.get<Parameters<typeof mapCustomerAdvance>[0]>(
        `/advances/${id}`,
      );
      return mapCustomerAdvance(advance);
    },
    create(input: AdvanceInput): Promise<CustomerAdvance> {
      return api
        .post<Parameters<typeof mapCustomerAdvance>[0]>("/advances", input)
        .then(mapCustomerAdvance);
    },
    update(id: string, input: Partial<AdvanceInput>): Promise<CustomerAdvance> {
      return api
        .patch<Parameters<typeof mapCustomerAdvance>[0]>(
          `/advances/${id}`,
          input,
        )
        .then(mapCustomerAdvance);
    },
    allocate(
      id: string,
      invoiceId: string,
      amount: number,
    ): Promise<CustomerAdvance> {
      return api
        .post<Parameters<typeof mapCustomerAdvance>[0]>(
          `/advances/${id}/allocate`,
          { invoiceId, amount },
        )
        .then(mapCustomerAdvance);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/advances/${id}`);
    },
  };
}

// ---- Alerts ----

export function alertsApi() {
  return {
    summary(): Promise<AlertsSummary> {
      return api.get<AlertsSummary>("/alerts");
    },
    notify(): Promise<{ created: number }> {
      return api.post<{ created: number }>("/alerts/notify", {});
    },
  };
}

// ---- Import ----

export interface ImportProductRow {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  unit?: string;
  purchasePrice?: number;
  salePrice?: number;
  taxRate?: number;
  trackStock?: boolean;
  reorderLevel?: number;
  barcode?: string;
}

export interface ImportPartyRow {
  type: "customer" | "supplier";
  name: string;
  code?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  creditLimit?: number;
  currency?: string;
}

export function importApi() {
  return {
    products(rows: ImportProductRow[], updateExisting = true): Promise<ImportResult> {
      return api.post<ImportResult>("/import/products", { rows, updateExisting });
    },
    parties(rows: ImportPartyRow[], updateExisting = true): Promise<ImportResult> {
      return api.post<ImportResult>("/import/parties", { rows, updateExisting });
    },
  };
}

// ---- Share ----

export function shareApi() {
  return {
    build(input: { type: "invoice" | "statement"; id?: string; partyId?: string; to?: string }): Promise<ShareLink> {
      return api.post<ShareLink>("/share", input);
    },
  };
}

// ---- Payment Vouchers ----

export interface PaymentVoucherInput {
  type: "receipt" | "payment";
  date: string;
  partyId?: string;
  accountId: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  description?: string;
  status?: "draft" | "approved" | "cancelled";
}

export function paymentVouchersApi() {
  return {
    async list(): Promise<PaymentVoucher[]> {
      const res = await api.getList<Parameters<typeof mapPaymentVoucher>[0]>(
        "/payment-vouchers?limit=100",
      );
      return res.data.map(mapPaymentVoucher);
    },
    async get(id: string): Promise<PaymentVoucher> {
      const voucher = await api.get<Parameters<typeof mapPaymentVoucher>[0]>(`/payment-vouchers/${id}`);
      return mapPaymentVoucher(voucher);
    },
    create(input: PaymentVoucherInput): Promise<PaymentVoucher> {
      return api
        .post<Parameters<typeof mapPaymentVoucher>[0]>("/payment-vouchers", input)
        .then(mapPaymentVoucher);
    },
    update(id: string, input: Partial<PaymentVoucherInput>): Promise<PaymentVoucher> {
      return api
        .patch<Parameters<typeof mapPaymentVoucher>[0]>(`/payment-vouchers/${id}`, input)
        .then(mapPaymentVoucher);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/payment-vouchers/${id}`);
    },
    void(id: string): Promise<PaymentVoucher> {
      return api
        .post<Parameters<typeof mapPaymentVoucher>[0]>(`/payment-vouchers/${id}/void`)
        .then(mapPaymentVoucher);
    },
  };
}

// ---- Sales Returns ----

export interface SalesReturnLineInput {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface SalesReturnInput {
  customerId: string;
  invoiceId?: string;
  warehouseId?: string;
  returnDate: string;
  lines: SalesReturnLineInput[];
  reason?: string;
  notes?: string;
}

export function salesReturnsApi() {
  return {
    async list(): Promise<SalesReturn[]> {
      const res = await api.getList<Parameters<typeof mapSalesReturn>[0]>(
        "/sales-returns?limit=100",
      );
      return res.data.map(mapSalesReturn);
    },
    async get(id: string): Promise<SalesReturn> {
      const ret = await api.get<Parameters<typeof mapSalesReturn>[0]>(`/sales-returns/${id}`);
      return mapSalesReturn(ret);
    },
    create(input: SalesReturnInput): Promise<SalesReturn> {
      return api
        .post<Parameters<typeof mapSalesReturn>[0]>("/sales-returns", input)
        .then(mapSalesReturn);
    },
    update(id: string, input: Partial<SalesReturnInput>): Promise<SalesReturn> {
      return api
        .patch<Parameters<typeof mapSalesReturn>[0]>(`/sales-returns/${id}`, input)
        .then(mapSalesReturn);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/sales-returns/${id}`);
    },
  };
}

// ---- Purchase Returns ----

export interface PurchaseReturnLineInput {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface PurchaseReturnInput {
  supplierId: string;
  invoiceId?: string;
  warehouseId?: string;
  returnDate: string;
  lines: PurchaseReturnLineInput[];
  reason?: string;
  notes?: string;
}

export function purchaseReturnsApi() {
  return {
    async list(): Promise<PurchaseReturn[]> {
      const res = await api.getList<Parameters<typeof mapPurchaseReturn>[0]>(
        "/purchase-returns?limit=100",
      );
      return res.data.map(mapPurchaseReturn);
    },
    async get(id: string): Promise<PurchaseReturn> {
      const ret = await api.get<Parameters<typeof mapPurchaseReturn>[0]>(`/purchase-returns/${id}`);
      return mapPurchaseReturn(ret);
    },
    create(input: PurchaseReturnInput): Promise<PurchaseReturn> {
      return api
        .post<Parameters<typeof mapPurchaseReturn>[0]>("/purchase-returns", input)
        .then(mapPurchaseReturn);
    },
    update(id: string, input: Partial<PurchaseReturnInput>): Promise<PurchaseReturn> {
      return api
        .patch<Parameters<typeof mapPurchaseReturn>[0]>(`/purchase-returns/${id}`, input)
        .then(mapPurchaseReturn);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/purchase-returns/${id}`);
    },
  };
}

// ---- Price Lists ----

export interface PriceListItemInput {
  productId?: string;
  productName: string;
  price: number;
  minQuantity?: number;
}

export interface PriceListInput {
  name: string;
  code: string;
  currency?: string;
  items: PriceListItemInput[];
  status?: "active" | "inactive";
  notes?: string;
}

export function priceListsApi() {
  return {
    async list(): Promise<PriceList[]> {
      const res = await api.getList<Parameters<typeof mapPriceList>[0]>(
        "/price-lists?limit=100",
      );
      return res.data.map(mapPriceList);
    },
    async get(id: string): Promise<PriceList> {
      const pl = await api.get<Parameters<typeof mapPriceList>[0]>(`/price-lists/${id}`);
      return mapPriceList(pl);
    },
    create(input: PriceListInput): Promise<PriceList> {
      return api
        .post<Parameters<typeof mapPriceList>[0]>("/price-lists", input)
        .then(mapPriceList);
    },
    update(id: string, input: Partial<PriceListInput>): Promise<PriceList> {
      return api
        .patch<Parameters<typeof mapPriceList>[0]>(`/price-lists/${id}`, input)
        .then(mapPriceList);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/price-lists/${id}`);
    },
  };
}

// ---- Delivery Notes ----

export interface DeliveryNoteLineInput {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  deliveredQuantity?: number;
}

export interface DeliveryNoteInput {
  orderId?: string;
  supplierId: string;
  warehouseId: string;
  expectedDate: string;
  lines: DeliveryNoteLineInput[];
  notes?: string;
}

export function deliveryNotesApi() {
  return {
    async list(): Promise<DeliveryNote[]> {
      const res = await api.getList<Parameters<typeof mapDeliveryNote>[0]>(
        "/delivery-notes?limit=100",
      );
      return res.data.map(mapDeliveryNote);
    },
    async get(id: string): Promise<DeliveryNote> {
      const note = await api.get<Parameters<typeof mapDeliveryNote>[0]>(`/delivery-notes/${id}`);
      return mapDeliveryNote(note);
    },
    create(input: DeliveryNoteInput): Promise<DeliveryNote> {
      return api
        .post<Parameters<typeof mapDeliveryNote>[0]>("/delivery-notes", input)
        .then(mapDeliveryNote);
    },
    update(id: string, input: Partial<DeliveryNoteInput>): Promise<DeliveryNote> {
      return api
        .patch<Parameters<typeof mapDeliveryNote>[0]>(`/delivery-notes/${id}`, input)
        .then(mapDeliveryNote);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/delivery-notes/${id}`);
    },
  };
}

// ---- Tax Reports ----

export interface TaxReportRange {
  from?: string;
  to?: string;
}

export function taxReportApi() {
  return {
    async generate(range?: TaxReportRange): Promise<TaxReport> {
      return api.get<TaxReport>("/reports/tax", { query: range ? { ...range } : undefined });
    },
  };
}

// ---- Loyalty ----

export interface LoyaltyEarnInput {
  customerId: string;
  points: number;
  reference?: string;
  description?: string;
}

export interface LoyaltyRedeemInput {
  customerId: string;
  points: number;
  reference?: string;
  description?: string;
}

export function loyaltyApi() {
  return {
    async listAccounts(): Promise<LoyaltyAccount[]> {
      const res = await api.getList<LoyaltyAccount>("/loyalty/accounts?limit=100");
      return res.data;
    },
    async transactions(customerId?: string): Promise<LoyaltyTransaction[]> {
      const res = await api.getList<LoyaltyTransaction>(
        "/loyalty/transactions?limit=100",
        { query: customerId ? { customerId } : undefined },
      );
      return res.data;
    },
    earn(input: LoyaltyEarnInput): Promise<LoyaltyAccount> {
      return api.post<LoyaltyAccount>("/loyalty/earn", input);
    },
    redeem(input: LoyaltyRedeemInput): Promise<LoyaltyAccount> {
      return api.post<LoyaltyAccount>("/loyalty/redeem", input);
    },
  };
}

// ---- Budgets ----

export interface BudgetInput {
  accountId: string;
  period: string;
  budgeted: number;
  notes?: string;
}

export function budgetsApi() {
  return {
    async list(): Promise<Budget[]> {
      const res = await api.getList<Budget>("/budgets?limit=100");
      return res.data;
    },
    create(input: BudgetInput): Promise<Budget> {
      return api.post<Budget>("/budgets", input);
    },
    update(id: string, input: Partial<BudgetInput>): Promise<Budget> {
      return api.patch<Budget>(`/budgets/${id}`, input);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/budgets/${id}`);
    },
  };
}

// ---- Landed Costs ----

export interface LandedCostInput {
  purchaseInvoiceId: string;
  totalAmount: number;
  allocationMethod: "value" | "quantity" | "weight";
  lines: Array<{ description: string; amount: number }>;
  notes?: string;
}

export function landedCostsApi() {
  return {
    async list(): Promise<LandedCost[]> {
      const res = await api.getList<LandedCost>("/landed-costs?limit=100");
      return res.data;
    },
    create(input: LandedCostInput): Promise<LandedCost> {
      return api.post<LandedCost>("/landed-costs", input);
    },
    update(id: string, input: Partial<LandedCostInput>): Promise<LandedCost> {
      return api.patch<LandedCost>(`/landed-costs/${id}`, input);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/landed-costs/${id}`);
    },
  };
}

// ---- Barcodes ----

export interface BarcodeGenerateInput {
  productId: string;
  format?: "upc-a" | "ean-13" | "code-128" | "qr";
  barcode?: string;
}

export function barcodeApi() {
  return {
    async list(): Promise<BarcodeEntry[]> {
      const res = await api.getList<BarcodeEntry>("/barcodes?limit=100");
      return res.data;
    },
    generate(input: BarcodeGenerateInput): Promise<BarcodeEntry> {
      return api.post<BarcodeEntry>("/barcodes/generate", input);
    },
    async remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/barcodes/${id}`);
    },
  };
}

// ---- Stock Transfers ----

export interface StockTransferLineInput {
  productId: string;
  productName?: string;
  quantity: number;
}

export interface StockTransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  lines: StockTransferLineInput[];
  notes?: string;
}

export function stockTransfersApi() {
  return {
    async list(): Promise<StockTransfer[]> {
      const res = await api.getList<StockTransfer>("/stock-transfers?limit=100");
      return res.data;
    },
    async get(id: string): Promise<StockTransfer> {
      return api.get<StockTransfer>(`/stock-transfers/${id}`);
    },
    create(input: StockTransferInput): Promise<StockTransfer> {
      return api.post<StockTransfer>("/stock-transfers", input);
    },
    update(id: string, input: Partial<StockTransferInput>): Promise<StockTransfer> {
      return api.patch<StockTransfer>(`/stock-transfers/${id}`, input);
    },
    complete(id: string): Promise<StockTransfer> {
      return api.post<StockTransfer>(`/stock-transfers/${id}/complete`, {});
    },
    cancel(id: string): Promise<StockTransfer> {
      return api.post<StockTransfer>(`/stock-transfers/${id}/cancel`, {});
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/stock-transfers/${id}`);
    },
  };
}

// ---- Serial Numbers ----

export interface SerialNumberInput {
  productId: string;
  serialNumber: string;
  warehouseId?: string;
}

export interface SerialNumberBulkInput {
  productId: string;
  warehouseId?: string;
  serialNumbers: string[];
}

export interface SerialNumberAssignInput {
  serialNumberId: string;
  invoiceId: string;
  customerId: string;
}

export interface SerialNumberReturnInput {
  serialNumberId: string;
  invoiceId: string;
}

export function serialNumbersApi() {
  return {
    async list(query?: { status?: string; productId?: string }): Promise<SerialNumber[]> {
      const res = await api.getList<SerialNumber>(
        "/serial-numbers?limit=100",
        { query: query as Record<string, string | number | boolean> | undefined },
      );
      return res.data;
    },
    create(input: SerialNumberInput): Promise<SerialNumber> {
      return api.post<SerialNumber>("/serial-numbers", input);
    },
    bulkCreate(input: SerialNumberBulkInput): Promise<SerialNumber[]> {
      return api.post<SerialNumber[]>("/serial-numbers/bulk-create", input);
    },
    assign(input: SerialNumberAssignInput): Promise<SerialNumber> {
      return api.post<SerialNumber>("/serial-numbers/assign", {
        serialNumberId: input.serialNumberId,
        invoiceId: input.invoiceId,
      });
    },
    returnSerial(input: SerialNumberReturnInput): Promise<SerialNumber> {
      return api.post<SerialNumber>("/serial-numbers/return", {
        serialNumberId: input.serialNumberId,
      });
    },
  };
}

// ---- Warranties ----

export interface WarrantyInput {
  productId: string;
  customerId: string;
  serialNumber?: string;
  startDate: string;
  endDate: string;
  terms?: string;
}

export interface WarrantyClaimInput {
  warrantyId: string;
  claimNotes: string;
}

export function warrantiesApi() {
  return {
    async list(): Promise<Warranty[]> {
      const res = await api.getList<Warranty>("/warranties?limit=100");
      return res.data;
    },
    async get(id: string): Promise<Warranty> {
      return api.get<Warranty>(`/warranties/${id}`);
    },
    create(input: WarrantyInput): Promise<Warranty> {
      return api.post<Warranty>("/warranties", input);
    },
    claim(input: WarrantyClaimInput): Promise<Warranty> {
      return api.post<Warranty>(`/warranties/${input.warrantyId}/claim`, {
        claimNotes: input.claimNotes,
      });
    },
  };
}

// ---- Profit Report ----

export interface ProfitReportRange {
  from?: string;
  to?: string;
}

export function profitReportApi() {
  return {
    getReport(range?: ProfitReportRange): Promise<ProfitReportItem[]> {
      return api.get<ProfitReportItem[]>("/reports/profit-by-product", {
        query: range ? { ...range } : undefined,
      });
    },
  };
}

// ---- General Ledger ----

export function generalLedgerApi() {
  return {
    getLedger(accountId: string, dateFrom?: string, dateTo?: string): Promise<GeneralLedgerReport> {
      return api.get<GeneralLedgerReport>("/reports/general-ledger", {
        query: { accountId, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) },
      });
    },
  };
}

// ---- Purchase Reports ----

export function purchaseReportApi() {
  return {
    bySupplier(dateFrom?: string, dateTo?: string): Promise<PurchaseBySupplier[]> {
      return api.get<PurchaseBySupplier[]>("/reports/purchases/by-supplier", {
        query: { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) },
      });
    },
    byCategory(dateFrom?: string, dateTo?: string): Promise<PurchaseByCategory[]> {
      return api.get<PurchaseByCategory[]>("/reports/purchases/by-category", {
        query: { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) },
      });
    },
    trend(dateFrom?: string, dateTo?: string): Promise<PurchaseTrend[]> {
      return api.get<PurchaseTrend[]>("/reports/purchases/trend", {
        query: { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) },
      });
    },
  };
}

// ---- Currency Gain/Loss ----

export function currencyGainLossApi() {
  return {
    getReport(dateFrom?: string, dateTo?: string): Promise<CurrencyGainLossItem[]> {
      return api.get<CurrencyGainLossItem[]>("/reports/currency-gain-loss", {
        query: { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) },
      });
    },
  };
}

// ---- Period Comparison ----

export function periodComparisonApi() {
  return {
    compare(
      period1From: string,
      period1To: string,
      period2From: string,
      period2To: string,
    ): Promise<PeriodComparisonReport> {
      return api.get<PeriodComparisonReport>("/reports/period-comparison", {
        query: {
          "period1From": period1From,
          "period1To": period1To,
          "period2From": period2From,
          "period2To": period2To,
        },
      });
    },
  };
}

// ---- Branch Profit ----

export function branchProfitApi() {
  return {
    getReport(dateFrom?: string, dateTo?: string, costCenterId?: string): Promise<BranchProfitItem[]> {
      return api.get<BranchProfitItem[]>("/reports/branch-profit", {
        query: {
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          ...(costCenterId ? { costCenterId } : {}),
        },
      });
    },
  };
}

// ---- Custom Reports ----

export function customReportsApi() {
  return {
    async list(): Promise<CustomReport[]> {
      const res = await api.getList<CustomReport>("/custom-reports?limit=100");
      return res.data;
    },
    async getById(id: string): Promise<CustomReport> {
      return api.get<CustomReport>(`/custom-reports/${id}`);
    },
    create(input: Omit<CustomReport, "id" | "createdBy" | "createdAt" | "updatedAt">): Promise<CustomReport> {
      return api.post<CustomReport>("/custom-reports", input);
    },
    update(id: string, input: Partial<Omit<CustomReport, "id" | "createdBy" | "createdAt" | "updatedAt">>): Promise<CustomReport> {
      return api.patch<CustomReport>(`/custom-reports/${id}`, input);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/custom-reports/${id}`);
    },
    execute(id: string): Promise<unknown[]> {
      return api.get<unknown[]>(`/custom-reports/${id}/execute`);
    },
  };
}

// ---- Scheduled Reports ----

export function scheduledReportsApi() {
  return {
    async list(): Promise<ScheduledReport[]> {
      const res = await api.getList<ScheduledReport>("/scheduled-reports?limit=100");
      return res.data;
    },
    async getById(id: string): Promise<ScheduledReport> {
      return api.get<ScheduledReport>(`/scheduled-reports/${id}`);
    },
    create(input: Omit<ScheduledReport, "id" | "createdBy" | "createdAt" | "updatedAt" | "lastRunDate">): Promise<ScheduledReport> {
      return api.post<ScheduledReport>("/scheduled-reports", input);
    },
    update(id: string, input: Partial<Omit<ScheduledReport, "id" | "createdBy" | "createdAt" | "updatedAt">>): Promise<ScheduledReport> {
      return api.patch<ScheduledReport>(`/scheduled-reports/${id}`, input);
    },
    remove(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/scheduled-reports/${id}`);
    },
    runNow(id: string): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>(`/scheduled-reports/${id}/run`, {});
    },
  };
}

// ---- Payment Gateways ----

export interface PaymentGatewayConfigInput {
  name: string;
  type: PaymentGatewayConfig["type"];
  apiKey?: string;
  merchantId?: string;
  sandboxMode?: boolean;
}

export function paymentGatewaysApi() {
  return {
    async listConfigs(): Promise<PaymentGatewayConfig[]> {
      const res = await api.getList<PaymentGatewayConfig>("/payment-gateways?limit=100");
      return res.data;
    },
    createConfig(input: PaymentGatewayConfigInput): Promise<PaymentGatewayConfig> {
      return api.post<PaymentGatewayConfig>("/payment-gateways", input);
    },
    updateConfig(id: string, input: Partial<PaymentGatewayConfigInput>): Promise<PaymentGatewayConfig> {
      return api.patch<PaymentGatewayConfig>(`/payment-gateways/${id}`, input);
    },
    deleteConfig(id: string): Promise<{ id: string }> {
      return api.delete<{ id: string }>(`/payment-gateways/${id}`);
    },
    async listTransactions(query?: { gatewayId?: string }): Promise<PaymentGatewayTransaction[]> {
      const res = await api.getList<PaymentGatewayTransaction>(
        "/payment-gateways/transactions?limit=100",
        { query: query as Record<string, string | number | boolean> | undefined },
      );
      return res.data;
    },
  };
}

// ---- Period Close ----

export function periodCloseApi() {
  return {
    async list(): Promise<PeriodClose[]> {
      const res = await api.getList<PeriodClose>("/period-close?limit=100");
      return res.data;
    },
    async getByPeriod(period: string): Promise<PeriodClose> {
      return api.get<PeriodClose>(`/period-close/${period}`);
    },
    close(input: { period: string; notes?: string }): Promise<PeriodClose> {
      return api.post<PeriodClose>("/period-close/close", input);
    },
    open(input: { period: string }): Promise<PeriodClose> {
      return api.post<PeriodClose>("/period-close/open", input);
    },
  };
}

// ---- Page Visibility (Admin) ----

export function pageVisibilityApi() {
  return {
    async get(): Promise<string[]> {
      const raw: any = await api.get("/settings/page-visibility");
      const hidden = raw?.data?.hiddenPages ?? raw?.hiddenPages;
      return Array.isArray(hidden) ? hidden : [];
    },
    async update(hiddenPages: string[]): Promise<string[]> {
      const raw: any = await api.post("/settings/page-visibility", { hiddenPages });
      const result = raw?.data?.hiddenPages ?? raw?.hiddenPages;
      return Array.isArray(result) ? result : [];
    },
  };
}
