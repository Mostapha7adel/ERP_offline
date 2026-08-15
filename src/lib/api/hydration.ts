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
