import { hashPassword } from "../core/security/password.js";
import { ALL_PERMISSIONS, SUPER_ADMIN_WILDCARD } from "../core/security/permissions.js";
import { prisma } from "../core/database/prisma.js";
import { resetCompanyCache } from "../core/database/company.js";
import { roleRepository } from "../modules/roles/role.repository.js";
import { userRepository } from "../modules/users/user.repository.js";
import { settingsRepository } from "../modules/settings/settings.repository.js";
import { logger } from "../core/logger/logger.js";

export const ADMIN_EMAIL = "admin@ledgerflow.local";
export const ADMIN_PASSWORD = "Admin@123!";

/** When true, the seed only creates the empty workspace scaffolding
 * (company, roles, admin user, default settings) with NO demo business data. */
const NO_DEMO_DATA = true;

const roleSeeds = [
  {
    name: "Super Admin",
    description: "Full unrestricted access",
    permissions: [SUPER_ADMIN_WILDCARD],
    isSystem: true,
  },
  {
    name: "Accountant",
    description: "Accounting, reporting and financial operations",
    permissions: [
      "customers:read", "customers:create", "customers:update",
      "suppliers:read", "suppliers:create", "suppliers:update",
      "products:read", "warehouses:read",
      "inventory:read", "inventory:adjust", "inventory:transfer",
      "sales:read", "sales:create", "sales:update",
      "purchases:read", "purchases:create", "purchases:update",
      "treasury:read", "treasury:create", "treasury:update",
      "accounting:read", "accounting:create", "accounting:update",
      "reports:read",
      "settings:read", "settings:update",
      "auth:me", "auth:changePassword",
      "purchase-orders:read", "purchase-orders:create", "purchase-orders:update",
      "purchase-orders:approve", "purchase-orders:receive",
      "assets:read", "assets:create", "assets:update", "assets:depreciate",
      "currencies:read", "currencies:create", "currencies:update",
      "advances:read", "advances:create", "advances:update", "advances:allocate",
      "alerts:read", "import:create", "share:read",
    ],
    isSystem: true,
  },
  {
    name: "Sales Manager",
    description: "Manage customers and sales",
    permissions: [
      "customers:read", "customers:create", "customers:update",
      "products:read",
      "inventory:read",
      "sales:read", "sales:create", "sales:update", "sales:void",
      "advances:read", "advances:create", "advances:update", "advances:allocate",
      "alerts:read", "share:read",
      "reports:read",
      "auth:me", "auth:changePassword",
    ],
    isSystem: true,
  },
  {
    name: "Viewer",
    description: "Read-only access",
    permissions: [
      "customers:read", "suppliers:read", "products:read", "warehouses:read",
      "inventory:read", "sales:read", "purchases:read", "treasury:read",
      "accounting:read", "reports:read", "settings:read",
      "purchase-orders:read", "assets:read", "currencies:read",
      "advances:read", "alerts:read", "share:read",
      "auth:me", "auth:changePassword",
    ],
    isSystem: true,
  },
];

/**
 * Seeds the database with the empty-workspace scaffolding.
 * Safe to call on every boot (idempotent via admin email check).
 */
export async function seedDatabase(): Promise<void> {
  if (await userRepository.findByEmail(ADMIN_EMAIL)) {
    await syncSystemRolePermissions();
    return;
  }

  // Default company (tenant root) — repositories scope writes to this.
  await prisma.company.upsert({
    where: { id: "company-default" },
    update: {},
    create: {
      id: "company-default",
      name: "LedgerFlow Co.",
      legalName: "LedgerFlow Trading LLC",
      currency: "EGP",
      fiscalYearStart: "01-01",
    },
  });
  resetCompanyCache();

  // Roles
  const roleIds = new Map<string, string>();
  for (const role of roleSeeds) {
    const created = await roleRepository.create({ data: role as never });
    roleIds.set(role.name, created.id);
  }
  const superAdminRoleId = roleIds.get("Super Admin")!;

  // Admin user
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await userRepository.create({
    data: {
      name: "System Administrator",
      email: ADMIN_EMAIL,
      passwordHash,
      roleId: superAdminRoleId,
      status: "active",
      mustChangePassword: true,
    },
  });

  // Settings (defaults only; no demo business data when NO_DEMO_DATA is set)
  await settingsRepository.set("company.name", "LedgerFlow Co.");
  await settingsRepository.set("company.legalName", "LedgerFlow Trading LLC");
  await settingsRepository.set("company.address", "");
  await settingsRepository.set("company.phone", "");
  await settingsRepository.set("company.email", "");
  await settingsRepository.set("company.taxNumber", "");
  await settingsRepository.set("company.currency", "EGP");
  await settingsRepository.set("company.fiscalYearStart", "01-01");
  await settingsRepository.set("prefs.lowStockThreshold", 10);
  await settingsRepository.set("prefs.invoicePrefix", "INV");
  await settingsRepository.set("prefs.purchasePrefix", "PUR");
  await settingsRepository.set("prefs.taxEnabled", true);
  await settingsRepository.set("prefs.defaultTaxRate", 14);
  await settingsRepository.set("prefs.dateFormat", "yyyy-MM-dd");
  await settingsRepository.set("prefs.notifyOnLowStock", true);
  await settingsRepository.set("prefs.notifyOnInvoiceCreated", true);
  await settingsRepository.set("prefs.costingMethod", "average");
  await settingsRepository.set("prefs.enforceCreditLimit", false);
  await settingsRepository.set("prefs.autoBackupEnabled", false);
  await settingsRepository.set("prefs.autoBackupFrequencyHours", 24);
  await settingsRepository.set("prefs.autoBackupRetention", 7);
  await settingsRepository.set("prefs.autoBackupFolder", "");

  // eslint-disable-next-line no-console
  console.log("[seed] Database initialized (empty workspace)");
  await syncSystemRolePermissions();
}

/**
 * Back-fills any permissions that were added after a system role was created
 * so existing installs gain access to new features without re-seeding.
 */
async function syncSystemRolePermissions(): Promise<void> {
  try {
    for (const seed of roleSeeds) {
      const role = await roleRepository.findByName(seed.name);
      if (!role || role.permissions.includes(SUPER_ADMIN_WILDCARD)) continue;
      const missing = seed.permissions.filter((p) => !role.permissions.includes(p));
      if (missing.length === 0) continue;
      await roleRepository.update({
        id: role.id,
        data: { permissions: [...role.permissions, ...missing] },
      });
      logger.info({ role: seed.name, added: missing.length }, "Synced new permissions onto system role");
    }
  } catch (err) {
    logger.warn({ err }, "Could not sync system role permissions");
  }
}

export { ALL_PERMISSIONS };
