import { hashPassword } from "../core/security/password.js";
import { ALL_PERMISSIONS, SUPER_ADMIN_WILDCARD } from "../core/security/permissions.js";
import { prisma } from "../core/database/prisma.js";
import { resetCompanyCache } from "../core/database/company.js";
import { roleRepository } from "../modules/roles/role.repository.js";
import { userRepository } from "../modules/users/user.repository.js";
import { partyRepository } from "../modules/parties/party.repository.js";
import { productRepository } from "../modules/products/product.repository.js";
import { warehouseRepository } from "../modules/warehouses/warehouse.repository.js";
import { stockItemRepository } from "../modules/inventory/inventory.repository.js";
import { treasuryAccountRepository } from "../modules/treasury/treasury.repository.js";
import { accountRepository } from "../modules/accounting/accounting.repository.js";
import { settingsRepository } from "../modules/settings/settings.repository.js";
export const ADMIN_EMAIL = "admin@ledgerflow.local";
export const ADMIN_PASSWORD = "Admin@123!";
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
            "auth:me", "auth:changePassword",
        ],
        isSystem: true,
    },
];
const customerSeeds = [
    { code: "CUS-0001", name: "Acme Corporation", email: "billing@acme.com", city: "Cairo", phone: "+201234567890", creditLimit: 50000, currency: "EGP" },
    { code: "CUS-0002", name: "Globex Trading", email: "ap@globex.io", city: "Alexandria", phone: "+201011122233", creditLimit: 30000, currency: "EGP" },
    { code: "CUS-0003", name: "Initech LLC", email: "invoices@initech.com", city: "Giza", phone: "+201002223344", creditLimit: 20000, currency: "EGP" },
    { code: "CUS-0004", name: "Umbrella Retail", email: "pay@umbrellaretail.co", city: "Mansoura", phone: "+201003334455", creditLimit: 15000, currency: "EGP" },
    { code: "CUS-0005", name: "Stark Industries", email: "finance@stark.com", city: "Hurghada", phone: "+201004445566", creditLimit: 40000, currency: "EGP" },
];
const supplierSeeds = [
    { code: "SUP-0001", name: "Cairo Supply Co.", email: "sales@cairosupply.com", city: "Cairo", phone: "+201005556677", taxNumber: "TAX-1001" },
    { code: "SUP-0002", name: "Delta Distributors", email: "orders@deltadist.com", city: "Tanta", phone: "+201006667788", taxNumber: "TAX-1002" },
    { code: "SUP-0003", name: "Nile Electronics", email: "support@nileel.com", city: "Cairo", phone: "+201007778899", taxNumber: "TAX-1003" },
];
const productSeeds = [
    { sku: "PRD-0001", name: "Office Chair Ergo", category: "Furniture", unit: "pcs", purchasePrice: 1200, salePrice: 2100, taxRate: 14, reorderLevel: 5 },
    { sku: "PRD-0002", name: "Standing Desk 120cm", category: "Furniture", unit: "pcs", purchasePrice: 3500, salePrice: 5200, taxRate: 14, reorderLevel: 3 },
    { sku: "PRD-0003", name: 'Laptop 15" i7 16GB', category: "Electronics", unit: "pcs", purchasePrice: 24000, salePrice: 32000, taxRate: 14, reorderLevel: 2 },
    { sku: "PRD-0004", name: "Wireless Mouse", category: "Accessories", unit: "pcs", purchasePrice: 300, salePrice: 650, taxRate: 14, reorderLevel: 20 },
    { sku: "PRD-0005", name: "Mechanical Keyboard", category: "Accessories", unit: "pcs", purchasePrice: 900, salePrice: 1600, taxRate: 14, reorderLevel: 10 },
    { sku: "PRD-0006", name: 'Monitor 27" 4K', category: "Electronics", unit: "pcs", purchasePrice: 6800, salePrice: 9500, taxRate: 14, reorderLevel: 4 },
    { sku: "PRD-0007", name: "A4 Paper Ream", category: "Consumables", unit: "ream", purchasePrice: 180, salePrice: 320, taxRate: 14, reorderLevel: 50 },
    { sku: "PRD-0008", name: "Ink Cartridge Black", category: "Consumables", unit: "pcs", purchasePrice: 450, salePrice: 800, taxRate: 14, reorderLevel: 30 },
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
];
/**
 * Seeds the database with a realistic starter dataset.
 * Safe to call on every boot (idempotent via admin email check).
 */
export async function seedDatabase() {
    if (await userRepository.findByEmail(ADMIN_EMAIL))
        return;
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
    const roleIds = new Map();
    for (const role of roleSeeds) {
        const created = await roleRepository.create({ data: role });
        roleIds.set(role.name, created.id);
    }
    const superAdminRoleId = roleIds.get("Super Admin");
    // Admin user
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    await userRepository.create({
        data: {
            name: "System Administrator",
            email: ADMIN_EMAIL,
            passwordHash,
            roleId: superAdminRoleId,
            status: "active",
        },
    });
    // Warehouses
    const mainWh = await warehouseRepository.create({ data: { code: "WH-001", name: "Main Warehouse", address: "Cairo", isDefault: true, status: "active" } });
    await warehouseRepository.create({ data: { code: "WH-002", name: "Secondary Warehouse", address: "Alexandria", isDefault: false, status: "active" } });
    // Parties
    for (const customer of customerSeeds) {
        await partyRepository.create({ data: { ...customer, type: "customer", status: "active", currency: "EGP" } });
    }
    for (const supplier of supplierSeeds) {
        await partyRepository.create({ data: { ...supplier, type: "supplier", status: "active", currency: "EGP" } });
    }
    // Products + stock
    const productMap = new Map();
    for (const product of productSeeds) {
        const created = await productRepository.create({ data: { ...product, type: "product", trackStock: true, status: "active" } });
        productMap.set(created.sku, created.id);
        await stockItemRepository.create({
            data: {
                productId: created.id,
                warehouseId: mainWh.id,
                quantityOnHand: 50,
                reservedQuantity: 0,
                reorderLevel: product.reorderLevel ?? 10,
                averageCost: product.purchasePrice,
            },
        });
    }
    // Treasury accounts
    await treasuryAccountRepository.create({ data: { name: "Petty Cash", type: "cash", currency: "EGP", openingBalance: 25000, balance: 25000, isActive: true } });
    await treasuryAccountRepository.create({ data: { name: "Main Bank Account", type: "bank", currency: "EGP", openingBalance: 1200000, balance: 1200000, isActive: true } });
    await treasuryAccountRepository.create({ data: { name: "Credit Card", type: "credit-card", currency: "EGP", openingBalance: 0, balance: 0, isActive: true } });
    // Chart of accounts
    for (const account of accountSeeds) {
        await accountRepository.create({ data: account });
    }
    // Settings
    await settingsRepository.set("company.name", "LedgerFlow Co.");
    await settingsRepository.set("company.legalName", "LedgerFlow Trading LLC");
    await settingsRepository.set("company.address", "Cairo, Egypt");
    await settingsRepository.set("company.phone", "+201000000000");
    await settingsRepository.set("company.email", "hello@ledgerflow.com");
    await settingsRepository.set("company.taxNumber", "TAX-000000");
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
    await settingsRepository.set("prefs.defaultWarehouseId", mainWh.id);
    // eslint-disable-next-line no-console
    console.log("[seed] Database seeded with demo data");
}
export { ALL_PERMISSIONS };
