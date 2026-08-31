import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import "@/app/index.css";
import { Providers } from "@/app/providers";
import { StartupGate } from "@/app/startup-gate";
import { AppShell } from "@/shared/components/layout/app-shell";
import { DeviceHeartbeat } from "@/features/network/use-device-heartbeat";
import { RealtimeSync } from "@/features/network/realtime-sync";
import { UpdateChecker } from "@/features/updates/update-checker";
import { NotFound } from "@/features/not-found";
import { LoginPage } from "@/features/auth/login";
import { initAuthTokenHandling } from "@/stores/auth-store";
import { useAuthStore } from "@/stores/auth-store";
import { applyLocale, useLocaleStore } from "@/stores/locale-store";
import {
  DashboardPage,
  CustomersPage,
  SuppliersPage,
  ProductsPage,
  WarehousesPage,
  InventoryPage,
  SalesPage,
  PurchasesPage,
  QuotesPage,
  RecurringPage,
  NotesPage,
  TreasuryPage,
  AccountingPage,
  FiscalYearPage,
  ReportsPage,
  UsersPage,
  ProfilePage,
  SettingsPage,
  BackupPage,
  NotificationsPage,
  DevicesPage,
  PurchaseOrdersPage,
  AssetsPage,
  AdvancesPage,
  AlertsPage,
  ImportPage,
  CurrenciesPage,
  PaymentVouchersPage,
  SalesReturnsPage,
  PurchaseReturnsPage,
  PriceListsPage,
  DeliveryNotesPage,
  TaxReportsPage,
  LoyaltyPage,
  BudgetsPage,
  LandedCostsPage,
  BarcodesPage,
  StockTransfersPage,
  SerialNumbersPage,
  WarrantiesPage,
  ProfitReportPage,
  PaymentGatewaysPage,
  GeneralLedgerPage,
  PurchaseReportsPage,
  CurrencyGainLossPage,
  PeriodComparisonPage,
  BranchProfitPage,
  CustomReportsPage,
  ScheduledReportsPage,
  PeriodClosePage,
} from "@/features";

import { PageManagerPage } from "@/features/page-manager/page-manager-page";

/**
 * Only the super admin (wildcard) may manage users and roles; every other role
 * sees the Profile page instead and must never reach these admin routes.
 */
function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  return isSuperAdmin ? <>{children}</> : <Navigate to="/app/profile" replace />;
}

const router = createHashRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "suppliers", element: <SuppliersPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "warehouses", element: <WarehousesPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "sales", element: <SalesPage /> },
      { path: "purchases", element: <PurchasesPage /> },
      { path: "quotes", element: <QuotesPage /> },
      { path: "recurring", element: <RecurringPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "purchase-orders", element: <PurchaseOrdersPage /> },
      { path: "treasury", element: <TreasuryPage /> },
      { path: "accounting", element: <AccountingPage /> },
      { path: "fiscal-year", element: <FiscalYearPage /> },
      { path: "assets", element: <AssetsPage /> },
      { path: "advances", element: <AdvancesPage /> },
      { path: "payment-vouchers", element: <PaymentVouchersPage /> },
      { path: "sales-returns", element: <SalesReturnsPage /> },
      { path: "purchase-returns", element: <PurchaseReturnsPage /> },
      { path: "price-lists", element: <PriceListsPage /> },
      { path: "delivery-notes", element: <DeliveryNotesPage /> },
      { path: "tax-reports", element: <TaxReportsPage /> },
      { path: "loyalty", element: <LoyaltyPage /> },
      { path: "budgets", element: <BudgetsPage /> },
      { path: "landed-costs", element: <LandedCostsPage /> },
      { path: "barcodes", element: <BarcodesPage /> },
      { path: "stock-transfers", element: <StockTransfersPage /> },
      { path: "serial-numbers", element: <SerialNumbersPage /> },
      { path: "warranties", element: <WarrantiesPage /> },
      { path: "profit-report", element: <ProfitReportPage /> },
      { path: "payment-gateways", element: <PaymentGatewaysPage /> },
      { path: "general-ledger", element: <GeneralLedgerPage /> },
      { path: "purchase-reports", element: <PurchaseReportsPage /> },
      { path: "currency-gain-loss", element: <CurrencyGainLossPage /> },
      { path: "period-comparison", element: <PeriodComparisonPage /> },
      { path: "branch-profit", element: <BranchProfitPage /> },
      { path: "custom-reports", element: <CustomReportsPage /> },
      { path: "scheduled-reports", element: <ScheduledReportsPage /> },
      { path: "period-close", element: <PeriodClosePage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "users", element: <SuperAdminOnly><UsersPage /></SuperAdminOnly> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/pages", element: <SuperAdminOnly><PageManagerPage /></SuperAdminOnly> },
      { path: "backup", element: <BackupPage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "currencies", element: <CurrenciesPage /> },
      { path: "devices", element: <DevicesPage /> },
      { path: "notifications", element: <NotificationsPage /> },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

export function App() {
  return (
    <StartupGate>
      <DeviceHeartbeat />
      <RealtimeSync />
      <UpdateChecker />
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StartupGate>
  );
}

export function bootstrap() {
  initAuthTokenHandling();
  applyLocale(useLocaleStore.getState().locale);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}