/**
 * LedgerFlow — production seed data for the SQLite database.
 *
 * Seeds: default company, RBAC (permissions, roles, admin user),
 * warehouses, customers, suppliers, product catalog, stock, treasury
 * accounts, chart of accounts, cost centers and settings.
 *
 * Idempotent: safe to run repeatedly (upserts by unique keys).
 *
 * Run: npm run prisma:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const ADMIN_EMAIL = "admin@ledgerflow.local";
const ADMIN_PASSWORD = "Admin@123!";
const COMPANY_NAME = "LedgerFlow Co.";

// Mirror of src/core/security/permissions.ts — single source for RBAC.
const PERMISSION_CODES = [
  "auth:me", "auth:changePassword",
  "users:read", "users:create", "users:update", "users:delete",
  "roles:read", "roles:create", "roles:update", "roles:delete",
  "customers:read", "customers:create", "customers:update", "customers:delete",
  "suppliers:read", "suppliers:create", "suppliers:update", "suppliers:delete",
  "products:read", "products:create", "products:update", "products:delete",
  "warehouses:read", "warehouses:create", "warehouses:update", "warehouses:delete",
  "inventory:read", "inventory:adjust", "inventory:transfer",
  "sales:read", "sales:create", "sales:update", "sales:void",
  "purchases:read", "purchases:create", "purchases:update", "purchases:void",
  "treasury:read", "treasury:create", "treasury:update", "treasury:delete",
  "accounting:read", "accounting:create", "accounting:update", "accounting:delete",
  "reports:read",
  "settings:read", "settings:update",
  "backup:create", "backup:read", "backup:delete",
  "restore:create",
  "audit:read",
] as const;

interface RoleSeed {
  name: string;
  description: string;
  isSystem: boolean;
  permissions: readonly string[];
}

const roleSeeds: RoleSeed[] = [
  {
    name: "Super Admin",
    description: "Full unrestricted access",
    isSystem: true,
    permissions: ["*"],
  },
  {
    name: "Accountant",
    description: "Accounting, reporting and financial operations",
    isSystem: true,
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
    ],
  },
  {
    name: "Sales Manager",
    description: "Manage customers and sales",
    isSystem: true,
    permissions: [
      "customers:read", "customers:create", "customers:update",
      "products:read",
      "inventory:read",
      "sales:read", "sales:create", "sales:update", "sales:void",
      "reports:read",
      "auth:me", "auth:changePassword",
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access",
    isSystem: true,
    permissions: [
      "customers:read", "suppliers:read", "products:read", "warehouses:read",
      "inventory:read", "sales:read", "purchases:read", "treasury:read",
      "accounting:read", "reports:read", "settings:read",
      "auth:me", "auth:changePassword",
    ],
  },
];

const customerSeeds = [
  { code: "CUS-0001", name: "Acme Corporation", email: "billing@acme.com", city: "Cairo", phone: "+201234567890", creditLimit: 50000 },
  { code: "CUS-0002", name: "Globex Trading", email: "ap@globex.io", city: "Alexandria", phone: "+201011122233", creditLimit: 30000 },
  { code: "CUS-0003", name: "Initech LLC", email: "invoices@initech.com", city: "Giza", phone: "+201002223344", creditLimit: 20000 },
  { code: "CUS-0004", name: "Umbrella Retail", email: "pay@umbrellaretail.co", city: "Mansoura", phone: "+201003334455", creditLimit: 15000 },
  { code: "CUS-0005", name: "Stark Industries", email: "finance@stark.com", city: "Hurghada", phone: "+201004445566", creditLimit: 40000 },
];

const supplierSeeds = [
  { code: "SUP-0001", name: "Cairo Supply Co.", email: "sales@cairosupply.com", city: "Cairo", phone: "+201005556677", taxNumber: "TAX-1001" },
  { code: "SUP-0002", name: "Delta Distributors", email: "orders@deltadist.com", city: "Tanta", phone: "+201006667788", taxNumber: "TAX-1002" },
  { code: "SUP-0003", name: "Nile Electronics", email: "support@nileel.com", city: "Cairo", phone: "+201007778899", taxNumber: "TAX-1003" },
];

const unitSeeds = [
  { code: "pcs", name: "Piece" },
  { code: "ream", name: "Ream" },
  { code: "kg", name: "Kilogram" },
  { code: "hr", name: "Hour" },
  { code: "box", name: "Box" },
];

const productSeeds = [
  { sku: "PRD-0001", name: "Office Chair Ergo", category: "Furniture", unitCode: "pcs", purchasePrice: 1200, salePrice: 2100, taxRate: 14, reorderLevel: 5 },
  { sku: "PRD-0002", name: "Standing Desk 120cm", category: "Furniture", unitCode: "pcs", purchasePrice: 3500, salePrice: 5200, taxRate: 14, reorderLevel: 3 },
  { sku: "PRD-0003", name: 'Laptop 15" i7 16GB', category: "Electronics", unitCode: "pcs", purchasePrice: 24000, salePrice: 32000, taxRate: 14, reorderLevel: 2 },
  { sku: "PRD-0004", name: "Wireless Mouse", category: "Accessories", unitCode: "pcs", purchasePrice: 300, salePrice: 650, taxRate: 14, reorderLevel: 20 },
  { sku: "PRD-0005", name: "Mechanical Keyboard", category: "Accessories", unitCode: "pcs", purchasePrice: 900, salePrice: 1600, taxRate: 14, reorderLevel: 10 },
  { sku: "PRD-0006", name: 'Monitor 27" 4K', category: "Electronics", unitCode: "pcs", purchasePrice: 6800, salePrice: 9500, taxRate: 14, reorderLevel: 4 },
  { sku: "PRD-0007", name: "A4 Paper Ream", category: "Consumables", unitCode: "ream", purchasePrice: 180, salePrice: 320, taxRate: 14, reorderLevel: 50 },
  { sku: "PRD-0008", name: "Ink Cartridge Black", category: "Consumables", unitCode: "pcs", purchasePrice: 450, salePrice: 800, taxRate: 14, reorderLevel: 30 },
];

const accountSeeds = [
  { code: "1000", name: "Cash on Hand", type: "asset", category: "Current Assets", openingBalance: 250000 },
  { code: "1100", name: "Bank Account - Main", type: "asset", category: "Current Assets", openingBalance: 1200000 },
  { code: "1200", name: "Accounts Receivable", type: "asset", category: "Current Assets", openingBalance: 0 },
  { code: "1300", name: "Inventory", type: "asset", category: "Current Assets", openingBalance: 0 },
  { code: "2000", name: "Accounts Payable", type: "liability", category: "Current Liabilities", openingBalance: 0 },
  { code: "2100", name: "Sales Tax Payable", type: "liability", category: "Current Liabilities", openingBalance: 0 },
  { code: "3000", name: "Owner's Equity", type: "equity", category: "Equity", openingBalance: 1450000 },
  { code: "4000", name: "Sales Revenue", type: "revenue", category: "Revenue", openingBalance: 0 },
  { code: "5000", name: "Cost of Goods Sold", type: "expense", category: "Operating Expenses", openingBalance: 0 },
  { code: "6100", name: "Rent & Utilities", type: "expense", category: "Operating Expenses", openingBalance: 0 },
  { code: "6200", name: "Salaries & Wages", type: "expense", category: "Operating Expenses", openingBalance: 0 },
  { code: "6300", name: "Marketing", type: "expense", category: "Operating Expenses", openingBalance: 0 },
] as const;

const costCenterSeeds = [
  { code: "CC-100", name: "General Administration" },
  { code: "CC-200", name: "Sales & Marketing" },
  { code: "CC-300", name: "Operations / Warehouse" },
  { code: "CC-400", name: "Finance & Accounting" },
];

const settingsSeeds: Record<string, { value: string; group: string }> = {
  "company.name": { value: COMPANY_NAME, group: "company" },
  "company.legalName": { value: "LedgerFlow Trading LLC", group: "company" },
  "company.address": { value: "Cairo, Egypt", group: "company" },
  "company.phone": { value: "+201000000000", group: "company" },
  "company.email": { value: "hello@ledgerflow.com", group: "company" },
  "company.taxNumber": { value: "TAX-000000", group: "company" },
  "company.currency": { value: "EGP", group: "company" },
  "company.fiscalYearStart": { value: "01-01", group: "company" },
  "prefs.lowStockThreshold": { value: "10", group: "prefs" },
  "prefs.invoicePrefix": { value: "INV", group: "prefs" },
  "prefs.purchasePrefix": { value: "PUR", group: "prefs" },
  "prefs.taxEnabled": { value: "true", group: "prefs" },
  "prefs.defaultTaxRate": { value: "14", group: "prefs" },
  "prefs.dateFormat": { value: "yyyy-MM-dd", group: "prefs" },
  "prefs.notifyOnLowStock": { value: "true", group: "prefs" },
  "prefs.notifyOnInvoiceCreated": { value: "true", group: "prefs" },
};

async function main(): Promise<void> {
  console.log("[seed] Starting database seed...");

  // 1. Default company (tenant root)
  const company = await prisma.company.upsert({
    where: { id: (await prisma.company.findFirst())?.id ?? "company-default" },
    update: { name: COMPANY_NAME },
    create: { id: "company-default", name: COMPANY_NAME, legalName: "LedgerFlow Trading LLC", currency: "EGP", fiscalYearStart: "01-01" },
  });
  const companyId = company.id;

  // 2. Permissions
  const permissionRows = await Promise.all(
    PERMISSION_CODES.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: { group: code.split(":")[0] },
        create: { code, group: code.split(":")[0] },
      }),
    ),
  );
  const permissionByCode = new Map(permissionRows.map((p) => [p.code, p.id]));

  // Super-admin wildcard permission
  await prisma.permission.upsert({
    where: { code: "*" },
    update: { group: "system", description: "Super admin wildcard" },
    create: { code: "*", group: "system", description: "Super admin wildcard" },
  });

  // 3. Roles + role-permission links
  for (const role of roleSeeds) {
    const created = await prisma.role.upsert({
      where: { companyId_name: { companyId, name: role.name } },
      update: { description: role.description, isSystem: role.isSystem },
      create: { companyId, name: role.name, description: role.description, isSystem: role.isSystem },
    });

    // Assign permissions
    const permissionIds = role.permissions.includes("*")
      ? ["*", ...PERMISSION_CODES]
      : role.permissions;
    for (const code of permissionIds) {
      const pid = permissionByCode.get(code);
      if (!pid) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: created.id, permissionId: pid } },
        update: {},
        create: { roleId: created.id, permissionId: pid },
      });
    }
  }

  // 4. Admin user
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  const adminRole = await prisma.role.findFirst({
    where: { companyId, name: "Super Admin" },
  });
  if (!adminRole) throw new Error("Super Admin role missing after seed");
  await prisma.user.upsert({
    where: { companyId_email: { companyId, email: ADMIN_EMAIL } },
    update: { name: "System Administrator", roleId: adminRole.id, status: "active" },
    create: {
      companyId,
      name: "System Administrator",
      email: ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole.id,
      status: "active",
    },
  });

  // 5. Units
  const unitByCode = new Map<string, string>();
  for (const unit of unitSeeds) {
    const created = await prisma.unit.upsert({
      where: { code: unit.code },
      update: { name: unit.name },
      create: unit,
    });
    unitByCode.set(unit.code, created.id);
  }

  // 6. Categories + products
  const categoryIds = new Map<string, string>();
  const productCategoryCodes = new Set(productSeeds.map((p) => p.category));
  for (const catName of productCategoryCodes) {
    const created = await prisma.category.upsert({
      where: { companyId_name: { companyId, name: catName } },
      update: {},
      create: { companyId, name: catName },
    });
    categoryIds.set(catName, created.id);
  }

  // 7. Warehouses + default warehouse id for stock + settings
  const mainWh = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId, code: "WH-001" } },
    update: { isDefault: true },
    create: { companyId, code: "WH-001", name: "Main Warehouse", address: "Cairo", isDefault: true, status: "active" },
  });
  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId, code: "WH-002" } },
    update: {},
    create: { companyId, code: "WH-002", name: "Secondary Warehouse", address: "Alexandria", isDefault: false, status: "active" },
  });

  // 8. Parties (customers & suppliers)
  for (const customer of customerSeeds) {
    await prisma.party.upsert({
      where: { companyId_code: { companyId, code: customer.code } },
      update: { name: customer.name, email: customer.email, city: customer.city, phone: customer.phone, creditLimit: customer.creditLimit },
      create: { companyId, type: "customer", status: "active", currency: "EGP", ...customer },
    });
  }
  for (const supplier of supplierSeeds) {
    await prisma.party.upsert({
      where: { companyId_code: { companyId, code: supplier.code } },
      update: { name: supplier.name, email: supplier.email, city: supplier.city, phone: supplier.phone, taxNumber: supplier.taxNumber },
      create: { companyId, type: "supplier", status: "active", currency: "EGP", ...supplier },
    });
  }

  // 9. Products + stock items
  const adminUser = await prisma.user.findFirstOrThrow({
    where: { companyId, email: ADMIN_EMAIL },
  });
  for (const product of productSeeds) {
    const unitId = unitByCode.get(product.unitCode);
    if (!unitId) throw new Error(`Missing unit ${product.unitCode}`);
    const created = await prisma.product.upsert({
      where: { companyId_sku: { companyId, sku: product.sku } },
      update: { name: product.name, purchasePrice: product.purchasePrice, salePrice: product.salePrice, reorderLevel: product.reorderLevel },
      create: {
        companyId,
        sku: product.sku,
        name: product.name,
        type: "product",
        categoryId: categoryIds.get(product.category) ?? null,
        unitId,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        taxRate: product.taxRate,
        trackStock: true,
        reorderLevel: product.reorderLevel,
        status: "active",
      },
    });
    await prisma.stockItem.upsert({
      where: { productId_warehouseId: { productId: created.id, warehouseId: mainWh.id } },
      update: { reorderLevel: product.reorderLevel, averageCost: product.purchasePrice },
      create: {
        companyId,
        productId: created.id,
        warehouseId: mainWh.id,
        quantityOnHand: 50,
        reservedQuantity: 0,
        reorderLevel: product.reorderLevel,
        averageCost: product.purchasePrice,
      },
    });
    // Initial stock movement (append-only ledger)
    await prisma.stockMovement.create({
      data: {
        companyId,
        productId: created.id,
        warehouseId: mainWh.id,
        type: "initial",
        quantity: 50,
        cost: product.purchasePrice,
        note: "Initial seed stock",
        createdBy: adminUser.id,
      },
    });
  }

  // 10. Treasury accounts
  const treasurySeeds = [
    { name: "Petty Cash", type: "cash", openingBalance: 25000 },
    { name: "Main Bank Account", type: "bank", openingBalance: 1200000 },
    { name: "Credit Card", type: "creditCard", openingBalance: 0 },
  ] as const;
  for (const acc of treasurySeeds) {
    const existing = await prisma.treasuryAccount.findFirst({ where: { companyId, name: acc.name } });
    if (!existing) {
      await prisma.treasuryAccount.create({
        data: {
          companyId,
          name: acc.name,
          type: acc.type,
          currency: "EGP",
          openingBalance: acc.openingBalance,
          balance: acc.openingBalance,
          isActive: true,
        },
      });
    }
  }

  // 11. Chart of accounts
  for (const acc of accountSeeds) {
    await prisma.account.upsert({
      where: { companyId_code: { companyId, code: acc.code } },
      update: { name: acc.name, type: acc.type, category: acc.category },
      create: { companyId, code: acc.code, name: acc.name, type: acc.type, category: acc.category, openingBalance: acc.openingBalance, isActive: true },
    });
  }

  // 12. Cost centers
  for (const cc of costCenterSeeds) {
    await prisma.costCenter.upsert({
      where: { companyId_code: { companyId, code: cc.code } },
      update: { name: cc.name },
      create: { companyId, code: cc.code, name: cc.name, isActive: true },
    });
  }

  // 13. Settings
  const defaultWarehouseId = mainWh.id;
  for (const [key, s] of Object.entries(settingsSeeds)) {
    await prisma.setting.upsert({
      where: { companyId_key: { companyId, key } },
      update: { value: s.value, group: s.group },
      create: { companyId, key, value: s.value, group: s.group },
    });
  }
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: "prefs.defaultWarehouseId" } },
    update: { value: defaultWarehouseId },
    create: { companyId, key: "prefs.defaultWarehouseId", value: defaultWarehouseId, group: "prefs" },
  });

  console.log("[seed] Database seeded successfully");
}

main()
  .catch((error) => {
    console.error("[seed] Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
