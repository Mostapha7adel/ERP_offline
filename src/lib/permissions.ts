import type { AppRole } from "@/types/domain";
import type { PermissionKey } from "@/types/navigation";

const ALL_PERMISSIONS: PermissionKey[] = [
  "dashboard.view",
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.delete",
  "suppliers.view",
  "suppliers.create",
  "suppliers.update",
  "suppliers.delete",
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "warehouses.view",
  "warehouses.create",
  "warehouses.update",
  "warehouses.delete",
  "inventory.view",
  "inventory.adjust",
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.delete",
  "purchases.view",
  "purchases.create",
  "purchases.update",
  "purchases.delete",
  "quotes.view",
  "quotes.create",
  "quotes.update",
  "quotes.delete",
  "recurring.view",
  "recurring.create",
  "recurring.update",
  "recurring.delete",
  "notes.view",
  "notes.create",
  "notes.update",
  "notes.void",
  "treasury.view",
  "treasury.create",
  "accounting.view",
  "accounting.post",
  "reports.view",
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "roles.view",
  "roles.manage",
  "settings.view",
  "settings.update",
  "backup.manage",
  "network.view",
];

const VIEW_ONLY: PermissionKey[] = ALL_PERMISSIONS.filter((p) =>
  p.endsWith(".view"),
);

export const defaultRoles: AppRole[] = [
  {
    id: "role_owner",
    name: "Owner",
    description: "Full access to every module and setting in LedgerFlow.",
    isSystem: true,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    id: "role_admin",
    name: "Administrator",
    description: "Manage day-to-day operations and most configuration.",
    isSystem: true,
    permissions: ALL_PERMISSIONS.filter(
      (p) => p !== "roles.manage" && p !== "backup.manage",
    ),
  },
  {
    id: "role_manager",
    name: "Manager",
    description: "Run the business modules without access control changes.",
    isSystem: true,
    permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith("settings") && !p.startsWith("roles") && !p.startsWith("users") && !p.startsWith("backup")),
  },
  {
    id: "role_viewer",
    name: "Viewer",
    description: "Read-only access to reports and business data.",
    isSystem: true,
    permissions: [...VIEW_ONLY, "dashboard.view", "reports.view"],
  },
];

export const permissionLabels: Record<PermissionKey, string> = {
  "dashboard.view": "View Dashboard",
  "customers.view": "View Customers",
  "customers.create": "Create Customers",
  "customers.update": "Edit Customers",
  "customers.delete": "Delete Customers",
  "suppliers.view": "View Suppliers",
  "suppliers.create": "Create Suppliers",
  "suppliers.update": "Edit Suppliers",
  "suppliers.delete": "Delete Suppliers",
  "products.view": "View Products",
  "products.create": "Create Products",
  "products.update": "Edit Products",
  "products.delete": "Delete Products",
  "warehouses.view": "View Warehouses",
  "warehouses.create": "Create Warehouses",
  "warehouses.update": "Edit Warehouses",
  "warehouses.delete": "Delete Warehouses",
  "inventory.view": "View Inventory",
  "inventory.adjust": "Adjust Stock Levels",
  "sales.view": "View Sales",
  "sales.create": "Create Sales",
  "sales.update": "Edit Sales",
  "sales.delete": "Delete Sales",
  "purchases.view": "View Purchases",
  "purchases.create": "Create Purchases",
  "purchases.update": "Edit Purchases",
  "purchases.delete": "Delete Purchases",
  "quotes.view": "View Quotes",
  "quotes.create": "Create Quotes",
  "quotes.update": "Edit Quotes",
  "quotes.delete": "Delete Quotes",
  "recurring.view": "View Recurring Invoices",
  "recurring.create": "Create Recurring Invoices",
  "recurring.update": "Edit Recurring Invoices",
  "recurring.delete": "Delete Recurring Invoices",
  "notes.view": "View Credit/Debit Notes",
  "notes.create": "Create Credit/Debit Notes",
  "notes.update": "Edit Credit/Debit Notes",
  "notes.void": "Void Credit/Debit Notes",
  "treasury.view": "View Treasury",
  "treasury.create": "Record Transactions",
  "accounting.view": "View Accounting",
  "accounting.post": "Post Entries",
  "reports.view": "View Reports",
  "users.view": "View Users",
  "users.create": "Create Users",
  "users.update": "Edit Users",
  "users.delete": "Delete Users",
  "roles.view": "View Roles",
  "roles.manage": "Manage Roles & Permissions",
  "settings.view": "View Settings",
  "settings.update": "Edit Settings",
  "backup.manage": "Manage Backup & Restore",
  "network.view": "View Network & Devices",
};

export function hasPermission(
  userPermissions: string[] | undefined,
  permission: PermissionKey | undefined,
): boolean {
  if (!permission) return true;
  if (!userPermissions) return false;
  return userPermissions.includes(permission);
}

export function can(
  permissions: string[] | undefined,
  key: PermissionKey,
): boolean {
  return hasPermission(permissions, key);
}

export function groupPermissions(
  permissions: string[],
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const permission of permissions) {
    const group = permission.split(".")[0] ?? "other";
    groups[group] = groups[group] ?? [];
    groups[group].push(permission);
  }
  return groups;
}
