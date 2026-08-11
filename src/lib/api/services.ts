import { api } from "./client";
import {
  mapParty,
  mapProduct,
  mapWarehouse,
  mapInvoice,
  mapAccount,
  mapJournalEntry,
  mapBankAccount,
  mapMoneyTransaction,
  mapUser,
  mapRole,
  mapAuditLog,
  mapNotification,
} from "./mappers";
import type {
  Party,
  Product,
  Warehouse,
  Invoice,
  Account,
  JournalEntry,
  BankAccount,
  MoneyTransaction,
  AppUser,
  AppRole,
  AppNotification,
  AuditLog,
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
      return api.post<LoginResult>("/auth/refresh", { refreshToken });
    },
    logout(refreshToken: string): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/auth/logout", { refreshToken });
    },
    changePassword(
      currentPassword: string,
      newPassword: string,
      email?: string,
    ): Promise<{ success: boolean; email: string; accessToken: string }> {
      return api.post<{ success: boolean; email: string; accessToken: string }>("/auth/change-password", {
        currentPassword,
        newPassword,
        email,
      });
    },
    completeSetup(): Promise<{ success: boolean; accessToken: string }> {
      return api.post<{ success: boolean; accessToken: string }>("/auth/complete-setup", {});
    },
    forgotPassword(email: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
      return api.post<{ success: boolean }>("/auth/forgot-password", { email, currentPassword, newPassword });
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
  };
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
        "/audit-logs?limit=200",
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


// ---- Network (LAN workspace) ----

export interface NetworkStatus {
  app: string;
  mode: string;
  workspaceReady: boolean;
  serverTime: string;
  hostIps: string[];
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
