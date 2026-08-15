import type { FastifyInstance } from "fastify";
import { registerAuthController } from "./auth/auth.controller.js";
import { registerUsersController } from "./users/user.controller.js";
import { registerRolesController } from "./roles/role.controller.js";
import { registerPartyController } from "./parties/party.controller.js";
import { registerProductsController } from "./products/product.controller.js";
import { registerWarehousesController } from "./warehouses/warehouse.controller.js";
import { registerInventoryController } from "./inventory/inventory.controller.js";
import { registerSalesController, registerPurchasesController } from "./trade/trade.controller.js";
import { registerNotesController } from "./notes/note.controller.js";
import { registerSalesQuotesController, registerPurchaseQuotesController } from "./quotes/quote.controller.js";
import { registerSalesRecurringController, registerPurchaseRecurringController } from "./recurring/recurring.controller.js";
import { registerTreasuryController } from "./treasury/treasury.controller.js";
import { registerAccountingController } from "./accounting/accounting.controller.js";
import { registerFiscalYearController } from "./accounting/fiscal-year.controller.js";
import { registerReportsController } from "./reports/reports.controller.js";
import { registerSettingsController } from "./settings/settings.controller.js";
import { registerBackupController } from "./backup/backup.controller.js";
import { registerAuditController } from "./audit/audit.controller.js";
import { registerNotificationsController } from "./notifications/notification.controller.js";
import { registerNetworkController } from "./network/network.controller.js";

/**
 * Feature modules are registered under the `/api/v1` prefix.
 * Order matters: auth and system modules register before resource modules
 * that reference their stores, though repositories are lazy so this is
 * primarily for route documentation grouping.
 */
export async function registerModules(app: FastifyInstance): Promise<void> {
  await app.register(
    async (scoped) => {
      await registerAuthController(scoped);
      await registerRolesController(scoped);
      await registerUsersController(scoped);
      await registerPartyController(scoped);
      await registerProductsController(scoped);
      await registerWarehousesController(scoped);
      await registerInventoryController(scoped);
      registerSalesController(scoped);
      registerPurchasesController(scoped);
      registerNotesController(scoped);
      registerSalesQuotesController(scoped);
      registerPurchaseQuotesController(scoped);
      registerSalesRecurringController(scoped);
      registerPurchaseRecurringController(scoped);
      await registerTreasuryController(scoped);
      await registerAccountingController(scoped);
      await registerFiscalYearController(scoped);
      await registerReportsController(scoped);
      await registerSettingsController(scoped);
      await registerBackupController(scoped);
      await registerAuditController(scoped);
      await registerNotificationsController(scoped);
      await registerNetworkController(scoped);
    },
    { prefix: "/api/v1" },
  );
}
