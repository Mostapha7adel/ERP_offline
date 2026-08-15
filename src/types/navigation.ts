import type { LucideIcon } from "lucide-react";

export type PermissionKey =
  | "dashboard.view"
  | "customers.view"
  | "customers.create"
  | "customers.update"
  | "customers.delete"
  | "suppliers.view"
  | "suppliers.create"
  | "suppliers.update"
  | "suppliers.delete"
  | "products.view"
  | "products.create"
  | "products.update"
  | "products.delete"
  | "warehouses.view"
  | "warehouses.create"
  | "warehouses.update"
  | "warehouses.delete"
  | "inventory.view"
  | "inventory.adjust"
  | "sales.view"
  | "sales.create"
  | "sales.update"
  | "sales.delete"
  | "purchases.view"
  | "purchases.create"
  | "purchases.update"
  | "purchases.delete"
  | "quotes.view"
  | "quotes.create"
  | "quotes.update"
  | "quotes.delete"
  | "recurring.view"
  | "recurring.create"
  | "recurring.update"
  | "recurring.delete"
  | "notes.view"
  | "notes.create"
  | "notes.update"
  | "notes.void"
  | "treasury.view"
  | "treasury.create"
  | "accounting.view"
  | "accounting.post"
  | "reports.view"
  | "users.view"
  | "users.create"
  | "users.update"
  | "users.delete"
  | "roles.view"
  | "roles.manage"
  | "settings.view"
  | "settings.update"
  | "backup.manage"
  | "network.view";

export interface NavItem {
  title: string;
  titleAr?: string;
  href: string;
  icon?: LucideIcon;
  badge?: "notifications";
  permission?: PermissionKey;
  /** When true only the super admin (wildcard) sees this item. */
  superAdminOnly?: boolean;
  keywords: string;
}

export interface NavSection {
  title: string;
  titleAr?: string;
  items: NavItem[];
}

export type ThemeMode = "light" | "dark" | "system";
