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
import { usePaymentVouchersStore } from "./payment-vouchers-store";
import { useSalesReturnsStore } from "./sales-returns-store";
import { usePurchaseReturnsStore } from "./purchase-returns-store";
import { usePriceListsStore } from "./price-lists-store";
import { useDeliveryNotesStore } from "./delivery-notes-store";
import { useLoyaltyStore } from "./loyalty-store";
import { useBudgetsStore } from "./budgets-store";
import { useLandedCostsStore } from "./landed-costs-store";
import { useStockTransfersStore } from "./stock-transfers-store";
import { useSerialNumbersStore } from "./serial-numbers-store";
import { useWarrantiesStore } from "./warranties-store";
import { usePaymentGatewaysStore } from "./payment-gateways-store";
import { useCustomReportsStore } from "./custom-reports-store";
import { useScheduledReportsStore } from "./scheduled-reports-store";
import { usePeriodCloseStore } from "./period-close-store";

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
  usePaymentVouchersStore.getState().reset();
  useSalesReturnsStore.getState().reset();
  usePurchaseReturnsStore.getState().reset();
  usePriceListsStore.getState().reset();
  useDeliveryNotesStore.getState().reset();
  useLoyaltyStore.getState().reset();
  useBudgetsStore.getState().reset();
  useLandedCostsStore.getState().reset();
  useStockTransfersStore.getState().reset();
  useSerialNumbersStore.getState().reset();
  useWarrantiesStore.getState().reset();
  usePaymentGatewaysStore.getState().reset();
  useCustomReportsStore.getState().reset();
  useScheduledReportsStore.getState().reset();
  usePeriodCloseStore.getState().reset();
}
