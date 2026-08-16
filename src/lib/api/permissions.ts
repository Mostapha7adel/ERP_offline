import type { PermissionKey } from "@/types/navigation";

/**
 * Maps backend permission codes (e.g. "customers:read") to the frontend
 * PermissionKey set used by the navigation / `useCan` gating.
 */
const BACKEND_TO_FRONTEND: Record<string, PermissionKey[]> = {
  "auth:me": [],
  "auth:changePassword": [],
  "users:read": ["users.view"],
  "users:create": ["users.create"],
  "users:update": ["users.update"],
  "users:delete": ["users.delete"],
  "roles:read": ["roles.view"],
  "roles:create": ["roles.manage"],
  "roles:update": ["roles.manage"],
  "roles:delete": ["roles.manage"],
  "customers:read": ["customers.view"],
  "customers:create": ["customers.create"],
  "customers:update": ["customers.update"],
  "customers:delete": ["customers.delete"],
  "suppliers:read": ["suppliers.view"],
  "suppliers:create": ["suppliers.create"],
  "suppliers:update": ["suppliers.update"],
  "suppliers:delete": ["suppliers.delete"],
  "products:read": ["products.view"],
  "products:create": ["products.create"],
  "products:update": ["products.update"],
  "products:delete": ["products.delete"],
  "warehouses:read": ["warehouses.view"],
  "warehouses:create": ["warehouses.create"],
  "warehouses:update": ["warehouses.update"],
  "warehouses:delete": ["warehouses.delete"],
  "inventory:read": ["inventory.view"],
  "inventory:adjust": ["inventory.adjust"],
  "inventory:transfer": ["inventory.adjust"],
  "sales:read": ["sales.view"],
  "sales:create": ["sales.create"],
  "sales:update": ["sales.update"],
  "sales:void": ["sales.delete"],
  "purchases:read": ["purchases.view"],
  "purchases:create": ["purchases.create"],
  "purchases:update": ["purchases.update"],
  "purchases:void": ["purchases.delete"],
  "quotes:read": ["quotes.view"],
  "quotes:create": ["quotes.create"],
  "quotes:update": ["quotes.update"],
  "quotes:delete": ["quotes.delete"],
  "recurring:read": ["recurring.view"],
  "recurring:create": ["recurring.create"],
  "recurring:update": ["recurring.update"],
  "recurring:delete": ["recurring.delete"],
  "notes:read": ["notes.view"],
  "notes:create": ["notes.create"],
  "notes:update": ["notes.update"],
  "notes:void": ["notes.void"],
  "treasury:read": ["treasury.view"],
  "treasury:create": ["treasury.create"],
  "treasury:update": ["treasury.create"],
  "treasury:delete": ["treasury.create"],
  "accounting:read": ["accounting.view"],
  "accounting:create": ["accounting.post"],
  "accounting:update": ["accounting.post"],
  "accounting:delete": ["accounting.post"],
  "reports:read": ["reports.view", "dashboard.view"],
  "settings:read": ["settings.view"],
  "settings:update": ["settings.update"],
  "backup:create": ["backup.manage"],
  "backup:read": ["backup.manage"],
  "backup:delete": ["backup.manage"],
  "restore:create": ["backup.manage"],
  "audit:read": ["settings.view", "backup.manage"],
  "network:read": ["network.view"],
  "network:manage": ["network.view"],
  "purchase-orders:read": ["purchase-orders.view"],
  "purchase-orders:create": ["purchase-orders.create"],
  "purchase-orders:update": ["purchase-orders.update"],
  "purchase-orders:approve": ["purchase-orders.approve"],
  "purchase-orders:receive": ["purchase-orders.receive"],
  "purchase-orders:delete": ["purchase-orders.delete"],
  "assets:read": ["assets.view"],
  "assets:create": ["assets.create"],
  "assets:update": ["assets.update"],
  "assets:depreciate": ["assets.depreciate"],
  "assets:delete": ["assets.delete"],
  "currencies:read": ["currencies.view"],
  "currencies:create": ["currencies.create"],
  "currencies:update": ["currencies.update"],
  "currencies:delete": ["currencies.delete"],
  "advances:read": ["advances.view"],
  "advances:create": ["advances.create"],
  "advances:update": ["advances.update"],
  "advances:allocate": ["advances.update"],
  "advances:delete": ["advances.delete"],
  "alerts:read": ["alerts.view"],
  "import:create": ["import.create"],
  "share:read": ["share.create"],
};

const ALL_FRONTEND_KEYS = Object.values(BACKEND_TO_FRONTEND).flat();

export function mapBackendPermissions(codes: string[]): PermissionKey[] {
  if (codes.includes("*")) {
    return [...new Set(ALL_FRONTEND_KEYS)];
  }
  const keys = codes.flatMap((code) => BACKEND_TO_FRONTEND[code] ?? []);
  return [...new Set(keys)];
}

const FRONTEND_TO_BACKEND = new Map<string, string>();
for (const [code, keys] of Object.entries(BACKEND_TO_FRONTEND)) {
  for (const key of keys) {
    if (!FRONTEND_TO_BACKEND.has(key)) FRONTEND_TO_BACKEND.set(key, code);
  }
}

/** Converts a frontend permission key set back to backend codes for role updates. */
export function mapFrontendPermissionsToBackend(keys: readonly string[]): string[] {
  const codes = keys.map((key) => FRONTEND_TO_BACKEND.get(key)).filter((c): c is string => Boolean(c));
  return [...new Set(codes)];
}
