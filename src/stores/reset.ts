import { useAccountsStore, useJournalStore } from "./accounting-store";
import { useInvoicesStore } from "./invoices-store";
import { useCustomersStore, useSuppliersStore } from "./parties-store";
import { useWarehousesStore, useInventoryStore } from "./inventory-store";
import { useProductsStore, useCategoriesStore } from "./products-store";
import { useUsersStore, useRolesStore, useAuditLogsStore } from "./system-store";
import { useBankAccountsStore, useTransactionsStore } from "./treasury-store";
import { useSettingsStore } from "./settings-store";
import { useCurrenciesStore } from "./currencies-store";
import { usePurchaseOrdersStore } from "./purchase-orders-store";
import { useAssetsStore } from "./assets-store";
import { useAdvancesStore } from "./advances-store";

/**
 * Reset every hydrated domain store to its default/empty state. Used when a
 * client device disconnects from a workspace so the host's data (copied into
 * this device's local storage by hydration) is not left behind.
 */
export function clearAllDomainData(): void {
  useAccountsStore.getState().reset();
  useJournalStore.getState().reset();
  useInvoicesStore.getState().reset();
  useCustomersStore.getState().reset();
  useSuppliersStore.getState().reset();
  useWarehousesStore.getState().reset();
  useInventoryStore.getState().reset();
  useProductsStore.getState().reset();
  useCategoriesStore.getState().reset();
  useUsersStore.getState().reset();
  useRolesStore.getState().reset();
  useAuditLogsStore.getState().reset();
  useBankAccountsStore.getState().reset();
  useTransactionsStore.getState().reset();
  useSettingsStore.getState().reset();
  useCurrenciesStore.getState().reset();
  usePurchaseOrdersStore.getState().reset();
  useAssetsStore.getState().reset();
  useAdvancesStore.getState().reset();
}
