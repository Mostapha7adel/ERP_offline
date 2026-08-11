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
};
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
/** Wildcard granted to super admins. */
export const SUPER_ADMIN_WILDCARD = "*";
