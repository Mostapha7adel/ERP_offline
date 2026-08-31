import { useCustomersStore, useSuppliersStore } from "@/stores/parties-store";
import { useProductsStore } from "@/stores/products-store";
import { useWarehousesStore, useInventoryStore } from "@/stores/inventory-store";
import { useInvoicesStore } from "@/stores/invoices-store";
import { useQuotesStore } from "@/stores/quotes-store";
import { useRecurringStore } from "@/stores/recurring-store";
import { useBankAccountsStore, useTransactionsStore } from "@/stores/treasury-store";
import { useAccountsStore, useJournalStore } from "@/stores/accounting-store";
import { useNotesStore } from "@/stores/notes-store";
import { useFiscalYearsStore } from "@/stores/fiscal-year-store";
import { useUsersStore, useRolesStore, useAuditLogsStore } from "@/stores/system-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrenciesStore } from "@/stores/currencies-store";
import { usePurchaseOrdersStore } from "@/stores/purchase-orders-store";
import { useAssetsStore } from "@/stores/assets-store";
import { useAdvancesStore } from "@/stores/advances-store";
import { usePaymentVouchersStore } from "@/stores/payment-vouchers-store";
import { useSalesReturnsStore } from "@/stores/sales-returns-store";
import { usePurchaseReturnsStore } from "@/stores/purchase-returns-store";
import { usePriceListsStore } from "@/stores/price-lists-store";
import { useDeliveryNotesStore } from "@/stores/delivery-notes-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import { useLandedCostsStore } from "@/stores/landed-costs-store";
import { useStockTransfersStore } from "@/stores/stock-transfers-store";
import { useSerialNumbersStore } from "@/stores/serial-numbers-store";
import { useWarrantiesStore } from "@/stores/warranties-store";
import { usePaymentGatewaysStore } from "@/stores/payment-gateways-store";
import { useCustomReportsStore } from "@/stores/custom-reports-store";
import { useScheduledReportsStore } from "@/stores/scheduled-reports-store";
import { usePeriodCloseStore } from "@/stores/period-close-store";
import { mapStockItem } from "@/lib/api/mappers";
import {
  partiesApi,
  productsApi,
  warehousesApi,
  inventoryApi,
  invoicesApi,
  quotesApi,
  recurringApi,
  treasuryApi,
  accountingApi,
  notesApi,
  fiscalYearApi,
  usersApi,
  rolesApi,
  auditApi,
  settingsApi,
  notificationsApi,
  currenciesApi,
  purchaseOrdersApi,
  assetsApi,
  advancesApi,
  alertsApi,
  paymentVouchersApi,
  salesReturnsApi,
  purchaseReturnsApi,
  priceListsApi,
  deliveryNotesApi,
  loyaltyApi,
  budgetsApi,
  landedCostsApi,
  stockTransfersApi,
  serialNumbersApi,
  warrantiesApi,
  paymentGatewaysApi,
  customReportsApi,
  scheduledReportsApi,
  periodCloseApi,
  pageVisibilityApi,
} from "@/lib/api";

/**
 * Pulls every resource from the backend API and seeds the zustand stores.
 * Individual calls are isolated so a single failure doesn't blank the app.
 */
export async function hydrateAll(): Promise<void> {
  await Promise.allSettled([
    hydrateParties(),
    hydrateProducts(),
    hydrateWarehouses(),
    hydrateInventory(),
    hydrateInvoices(),
    hydrateQuotes(),
    hydrateRecurring(),
    hydrateTreasury(),
    hydrateAccounting(),
    hydrateNotes(),
    hydrateFiscalYears(),
    hydrateUsersAndRoles(),
    hydrateAudit(),
    hydrateSettings(),
    hydrateNotifications(),
    hydrateCurrencies(),
    hydratePurchaseOrders(),
    hydrateAssets(),
    hydrateAdvances(),
    hydrateAlerts(),
    hydratePaymentVouchers(),
    hydrateSalesReturns(),
    hydratePurchaseReturns(),
    hydratePriceLists(),
    hydrateDeliveryNotes(),
    hydrateLoyalty(),
    hydrateBudgets(),
    hydrateLandedCosts(),
    hydrateStockTransfers(),
    hydrateSerialNumbers(),
    hydrateWarranties(),
    hydratePaymentGateways(),
    hydrateCustomReports(),
    hydrateScheduledReports(),
    hydratePeriodClose(),
    hydratePageVisibility(),
  ]);
}

export async function hydrateNotifications(): Promise<void> {
  try {
    const notifications = await notificationsApi().list();
    useNotificationsStore.getState().hydrate(notifications);
  } catch {
    // keep existing data
  }
}

export async function hydrateParties(): Promise<void> {
  try {
    const [customers, suppliers] = await Promise.all([
      partiesApi().list("customer"),
      partiesApi().list("supplier"),
    ]);
    useCustomersStore.getState().hydrate(customers);
    useSuppliersStore.getState().hydrate(suppliers);
  } catch {
    // keep existing (seeded) data
  }
}

export async function hydrateProducts(): Promise<void> {
  try {
    const products = await productsApi().list();
    useProductsStore.getState().hydrate(products);
  } catch {
    // keep existing data
  }
}

export async function hydrateWarehouses(): Promise<void> {
  try {
    const warehouses = await warehousesApi().list();
    useWarehousesStore.getState().hydrate(warehouses);
  } catch {
    // keep existing data
  }
}

export async function hydrateInventory(): Promise<void> {
  try {
    const rows = await inventoryApi().list();
    useInventoryStore.getState().hydrate(rows.map(mapStockItem));
  } catch {
    // keep existing data
  }
}

export async function hydrateInvoices(): Promise<void> {
  try {
    const [sales, purchases] = await Promise.all([
      invoicesApi().list("sale"),
      invoicesApi().list("purchase"),
    ]);
    useInvoicesStore.getState().hydrate([...sales, ...purchases]);
  } catch {
    // keep existing data
  }
}

export async function hydrateQuotes(): Promise<void> {
  try {
    const [sales, purchases] = await Promise.all([
      quotesApi().list("sale"),
      quotesApi().list("purchase"),
    ]);
    useQuotesStore.getState().hydrate([...sales, ...purchases]);
  } catch {
    // keep existing data
  }
}

export async function hydrateRecurring(): Promise<void> {
  try {
    const [sales, purchases] = await Promise.all([
      recurringApi().list("sale"),
      recurringApi().list("purchase"),
    ]);
    useRecurringStore.getState().hydrate([...sales, ...purchases]);
  } catch {
    // keep existing data
  }
}

export async function hydrateTreasury(): Promise<void> {
  try {
    const [accounts, transactions] = await Promise.all([
      treasuryApi().accounts(),
      treasuryApi().transactions(),
    ]);
    useBankAccountsStore.getState().hydrate(accounts);
    useTransactionsStore.getState().hydrate(transactions);
  } catch {
    // keep existing data
  }
}

export async function hydrateAccounting(): Promise<void> {
  try {
    const [accounts, journals] = await Promise.all([
      accountingApi().accounts(),
      accountingApi().journals(),
    ]);
    useAccountsStore.getState().hydrate(accounts);
    useJournalStore.getState().hydrate(journals.entries);
  } catch {
    // keep existing data
  }
}

export async function hydrateNotes(): Promise<void> {
  try {
    const notes = await notesApi().list();
    useNotesStore.getState().hydrate(notes);
  } catch {
    // keep existing data
  }
}

export async function hydrateFiscalYears(): Promise<void> {
  try {
    const years = await fiscalYearApi().list();
    useFiscalYearsStore.getState().hydrate(years);
  } catch {
    // keep existing data
  }
}

export async function hydrateUsersAndRoles(): Promise<void> {
  try {
    const [users, roles] = await Promise.all([
      usersApi().list(),
      rolesApi().list(),
    ]);
    useUsersStore.getState().hydrate(users);
    useRolesStore.getState().hydrate(roles);
    useAuthStore.getState().setRoles(roles);
  } catch {
    // keep existing data
  }
}

export async function hydrateAudit(): Promise<void> {
  try {
    const logs = await auditApi().list();
    useAuditLogsStore.getState().hydrate(logs);
  } catch {
    // keep existing data
  }
}

export async function hydrateSettings(): Promise<void> {
  try {
    const settings = await settingsApi().getAll();
    const { company, preferences } = settings;
    const settingsStore = useSettingsStore.getState();
    const current = settingsStore.company;
    // Merge rather than replace: the backend stores a single `address` string,
    // so keep the device's structured fields (street/state/country/…) unless
    // the backend actually provides a value. Otherwise re-hydrating after a
    // sign-in would silently wipe fields the user already filled in.
    settingsStore.updateCompany({
      name: company.name,
      legalName: company.legalName ?? current.legalName,
      taxId: company.taxNumber ?? current.taxId,
      email: company.email ?? current.email,
      phone: company.phone ?? current.phone,
      address: company.address
        ? { ...current.address, city: company.address }
        : current.address,
      currency: company.currency ?? current.currency,
      fiscalYearStart: company.fiscalYearStart ?? current.fiscalYearStart,
      website: current.website,
      registrationNumber: current.registrationNumber,
      logoInitials: (company.name ?? current.name ?? "LF").slice(0, 2).toUpperCase(),
    });
    settingsStore.updatePreferences({
      lowStockThreshold: preferences.lowStockThreshold,
      defaultTaxRate: preferences.defaultTaxRate,
      currency: company.currency ?? current.currency,
      dateFormat: preferences.dateFormat,
    });
  } catch {
    // keep existing data
  }
}

export async function hydrateCurrencies(): Promise<void> {
  try {
    const currencies = await currenciesApi().list();
    useCurrenciesStore.getState().hydrate(currencies);
  } catch {
    // keep existing data
  }
}

export async function hydratePurchaseOrders(): Promise<void> {
  try {
    const orders = await purchaseOrdersApi().list();
    usePurchaseOrdersStore.getState().hydrate(orders);
  } catch {
    // keep existing data
  }
}

export async function hydrateAssets(): Promise<void> {
  try {
    const assets = await assetsApi().list();
    useAssetsStore.getState().hydrate(assets);
  } catch {
    // keep existing data
  }
}

export async function hydrateAdvances(): Promise<void> {
  try {
    const advances = await advancesApi().list();
    useAdvancesStore.getState().hydrate(advances);
  } catch {
    // keep existing data
  }
}

export async function hydrateAlerts(): Promise<void> {
  try {
    const summary = await alertsApi().summary();
    // Alerts are fetched on demand by the alerts page; nothing to persist here.
    void summary;
  } catch {
    // keep existing data
  }
}

export async function hydratePaymentVouchers(): Promise<void> {
  try {
    const vouchers = await paymentVouchersApi().list();
    usePaymentVouchersStore.getState().hydrate(vouchers);
  } catch {
    // keep existing data
  }
}

export async function hydrateSalesReturns(): Promise<void> {
  try {
    const returns = await salesReturnsApi().list();
    useSalesReturnsStore.getState().hydrate(returns);
  } catch {
    // keep existing data
  }
}

export async function hydratePurchaseReturns(): Promise<void> {
  try {
    const returns = await purchaseReturnsApi().list();
    usePurchaseReturnsStore.getState().hydrate(returns);
  } catch {
    // keep existing data
  }
}

export async function hydratePriceLists(): Promise<void> {
  try {
    const lists = await priceListsApi().list();
    usePriceListsStore.getState().hydrate(lists);
  } catch {
    // keep existing data
  }
}

export async function hydrateDeliveryNotes(): Promise<void> {
  try {
    const notes = await deliveryNotesApi().list();
    useDeliveryNotesStore.getState().hydrate(notes);
  } catch {
    // keep existing data
  }
}

export async function hydrateLoyalty(): Promise<void> {
  try {
    const accounts = await loyaltyApi().listAccounts();
    useLoyaltyStore.getState().hydrate(accounts);
  } catch {
    // keep existing data
  }
}

export async function hydrateBudgets(): Promise<void> {
  try {
    const budgets = await budgetsApi().list();
    useBudgetsStore.getState().hydrate(budgets);
  } catch {
    // keep existing data
  }
}

export async function hydrateLandedCosts(): Promise<void> {
  try {
    const costs = await landedCostsApi().list();
    useLandedCostsStore.getState().hydrate(costs);
  } catch {
    // keep existing data
  }
}

export async function hydrateStockTransfers(): Promise<void> {
  try {
    const transfers = await stockTransfersApi().list();
    useStockTransfersStore.getState().hydrate(transfers);
  } catch {
    // keep existing data
  }
}

export async function hydrateSerialNumbers(): Promise<void> {
  try {
    const numbers = await serialNumbersApi().list();
    useSerialNumbersStore.getState().hydrate(numbers);
  } catch {
    // keep existing data
  }
}

export async function hydrateWarranties(): Promise<void> {
  try {
    const warranties = await warrantiesApi().list();
    useWarrantiesStore.getState().hydrate(warranties);
  } catch {
    // keep existing data
  }
}

export async function hydratePaymentGateways(): Promise<void> {
  try {
    const configs = await paymentGatewaysApi().listConfigs();
    usePaymentGatewaysStore.getState().hydrate(configs);
  } catch {
    // keep existing data
  }
}

export async function hydrateCustomReports(): Promise<void> {
  try {
    const reports = await customReportsApi().list();
    useCustomReportsStore.getState().hydrate(reports);
  } catch {
    // keep existing data
  }
}

export async function hydrateScheduledReports(): Promise<void> {
  try {
    const reports = await scheduledReportsApi().list();
    useScheduledReportsStore.getState().hydrate(reports);
  } catch {
    // keep existing data
  }
}

export async function hydratePeriodClose(): Promise<void> {
  try {
    const periods = await periodCloseApi().list();
    usePeriodCloseStore.getState().hydrate(periods);
  } catch {
    // keep existing data
  }
}

export async function hydratePageVisibility(): Promise<void> {
  try {
    const hiddenPages = await pageVisibilityApi().get();
    useSettingsStore.getState().setHiddenPages(hiddenPages);
  } catch {
    // keep existing data
  }
}
