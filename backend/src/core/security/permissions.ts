/**
 * Central permission registry for RBAC.
 * Format: `<resource>:<action>`.
 * These strings are stored on roles and embedded in the JWT so the frontend
 * can render UI without extra requests, and the backend can authorize
 * per-route with no DB lookup.
 */
export const PERMISSIONS = {
  // Auth
  "auth:me": "auth:me",
  "auth:changePassword": "auth:changePassword",

  // Users & roles
  "users:read": "users:read",
  "users:create": "users:create",
  "users:update": "users:update",
  "users:delete": "users:delete",
  "roles:read": "roles:read",
  "roles:create": "roles:create",
  "roles:update": "roles:update",
  "roles:delete": "roles:delete",

  // Parties
  "customers:read": "customers:read",
  "customers:create": "customers:create",
  "customers:update": "customers:update",
  "customers:delete": "customers:delete",
  "suppliers:read": "suppliers:read",
  "suppliers:create": "suppliers:create",
  "suppliers:update": "suppliers:update",
  "suppliers:delete": "suppliers:delete",

  // Catalog
  "products:read": "products:read",
  "products:create": "products:create",
  "products:update": "products:update",
  "products:delete": "products:delete",
  "products:barcode": "products:barcode",
  "warehouses:read": "warehouses:read",
  "warehouses:create": "warehouses:create",
  "warehouses:update": "warehouses:update",
  "warehouses:delete": "warehouses:delete",

  // Inventory
  "inventory:read": "inventory:read",
  "inventory:adjust": "inventory:adjust",
  "inventory:transfer": "inventory:transfer",

  // Trade
  "sales:read": "sales:read",
  "sales:create": "sales:create",
  "sales:update": "sales:update",
  "sales:void": "sales:void",
  "purchases:read": "purchases:read",
  "purchases:create": "purchases:create",
  "purchases:update": "purchases:update",
  "purchases:void": "purchases:void",
  "quotes:read": "quotes:read",
  "quotes:create": "quotes:create",
  "quotes:update": "quotes:update",
  "quotes:delete": "quotes:delete",
  "recurring:read": "recurring:read",
  "recurring:create": "recurring:create",
  "recurring:update": "recurring:update",
  "recurring:delete": "recurring:delete",

  // Credit / debit notes
  "notes:read": "notes:read",
  "notes:create": "notes:create",
  "notes:update": "notes:update",
  "notes:void": "notes:void",

  // Finance
  "treasury:read": "treasury:read",
  "treasury:create": "treasury:create",
  "treasury:update": "treasury:update",
  "treasury:delete": "treasury:delete",
  "accounting:read": "accounting:read",
  "accounting:create": "accounting:create",
  "accounting:update": "accounting:update",
  "accounting:delete": "accounting:delete",
  "reports:read": "reports:read",

  // System
  "settings:read": "settings:read",
  "settings:update": "settings:update",
  "backup:create": "backup:create",
  "backup:read": "backup:read",
  "backup:delete": "backup:delete",
  "restore:create": "restore:create",
  "audit:read": "audit:read",

  // Network (LAN workspace between devices)
  "network:read": "network:read",
  "network:manage": "network:manage",

  // Purchase orders
  "purchase-orders:read": "purchase-orders:read",
  "purchase-orders:create": "purchase-orders:create",
  "purchase-orders:update": "purchase-orders:update",
  "purchase-orders:approve": "purchase-orders:approve",
  "purchase-orders:receive": "purchase-orders:receive",
  "purchase-orders:delete": "purchase-orders:delete",

  // Fixed assets
  "assets:read": "assets:read",
  "assets:create": "assets:create",
  "assets:update": "assets:update",
  "assets:delete": "assets:delete",
  "assets:depreciate": "assets:depreciate",

  // Currencies
  "currencies:read": "currencies:read",
  "currencies:create": "currencies:create",
  "currencies:update": "currencies:update",
  "currencies:delete": "currencies:delete",

  // Customer advances
  "advances:read": "advances:read",
  "advances:create": "advances:create",
  "advances:update": "advances:update",
  "advances:allocate": "advances:allocate",
  "advances:delete": "advances:delete",

  // Price Lists
  "price-lists:read": "price-lists:read",
  "price-lists:create": "price-lists:create",
  "price-lists:update": "price-lists:update",
  "price-lists:delete": "price-lists:delete",

  // Delivery Notes
  "delivery-notes:read": "delivery-notes:read",
  "delivery-notes:create": "delivery-notes:create",
  "delivery-notes:update": "delivery-notes:update",
  "delivery-notes:delete": "delivery-notes:delete",

  // Alerts & imports
  "alerts:read": "alerts:read",
  "import:create": "import:create",
  "share:read": "share:read",

  // Reports (CRUD for custom/scheduled reports)
  "reports:create": "reports:create",

  // Tax reports
  "reports:tax": "reports:tax",

  // Loyalty points
  "loyalty:read": "loyalty:read",
  "loyalty:create": "loyalty:create",
  "loyalty:update": "loyalty:update",
  "loyalty:delete": "loyalty:delete",
  "loyalty:redeem": "loyalty:redeem",

  // Budgets
  "budgets:read": "budgets:read",
  "budgets:create": "budgets:create",
  "budgets:update": "budgets:update",
  "budgets:delete": "budgets:delete",

  // Landed costs
  "landed-costs:read": "landed-costs:read",
  "landed-costs:create": "landed-costs:create",
  "landed-costs:update": "landed-costs:update",
  "landed-costs:delete": "landed-costs:delete",

  // Payment vouchers
  "payment-vouchers:read": "payment-vouchers:read",
  "payment-vouchers:create": "payment-vouchers:create",
  "payment-vouchers:update": "payment-vouchers:update",
  "payment-vouchers:delete": "payment-vouchers:delete",

  // Sales returns
  "sales-returns:read": "sales-returns:read",
  "sales-returns:create": "sales-returns:create",
  "sales-returns:update": "sales-returns:update",
  "sales-returns:delete": "sales-returns:delete",

  // Purchase returns
  "purchase-returns:read": "purchase-returns:read",
  "purchase-returns:create": "purchase-returns:create",
  "purchase-returns:update": "purchase-returns:update",
  "purchase-returns:delete": "purchase-returns:delete",

  // Stock transfers
  "stock-transfers:read": "stock-transfers:read",
  "stock-transfers:create": "stock-transfers:create",
  "stock-transfers:update": "stock-transfers:update",
  "stock-transfers:delete": "stock-transfers:delete",

  // Serial numbers
  "serial-numbers:read": "serial-numbers:read",
  "serial-numbers:create": "serial-numbers:create",
  "serial-numbers:update": "serial-numbers:update",
  "serial-numbers:delete": "serial-numbers:delete",

  // Warranties
  "warranties:read": "warranties:read",
  "warranties:create": "warranties:create",
  "warranties:update": "warranties:update",
  "warranties:delete": "warranties:delete",

  // Payment gateways
  "payment-gateways:read": "payment-gateways:read",
  "payment-gateways:create": "payment-gateways:create",
  "payment-gateways:update": "payment-gateways:update",
  "payment-gateways:delete": "payment-gateways:delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Wildcard granted to super admins. */
export const SUPER_ADMIN_WILDCARD = "*";
