import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import "@/app/index.css";
import { Providers } from "@/app/providers";
import { StartupGate } from "@/app/startup-gate";
import { AppShell } from "@/shared/components/layout/app-shell";
import { DeviceHeartbeat } from "@/features/network/use-device-heartbeat";
import { RealtimeSync } from "@/features/network/realtime-sync";
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
} from "@/features";

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
      { path: "reports", element: <ReportsPage /> },
      { path: "users", element: <SuperAdminOnly><UsersPage /></SuperAdminOnly> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <SettingsPage /> },
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