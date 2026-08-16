import { stockItemRepository, batchRepository } from "../inventory/inventory.repository.js";
import { productRepository } from "../products/product.repository.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { recurringInvoiceRepository } from "../recurring/recurring.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { settingsRepository } from "../settings/settings.repository.js";
import type { AlertItem, AlertsSummary } from "./alert.entity.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateIso?: string): number | undefined {
  if (!dateIso) return undefined;
  const target = new Date(dateIso).getTime();
  return Math.ceil((target - Date.now()) / DAY_MS);
}

function toDateString(iso?: string): string | undefined {
  return iso ? iso.slice(0, 10) : undefined;
}

export class AlertService {
  /** Compute the full alert summary from live data. */
  async summary(): Promise<AlertsSummary> {
    const [lowStock, overdueInvoices, expiringBatches, recurringDue] = await Promise.all([
      this.lowStockAlerts(),
      this.overdueInvoiceAlerts(),
      this.expiringBatchAlerts(),
      this.recurringDueAlerts(),
    ]);
    const counts: Record<string, number> = {
      "low-stock": lowStock.length,
      "overdue-invoice": overdueInvoices.length,
      "expiring-batch": expiringBatches.length,
      "recurring-due": recurringDue.length,
    };
    return {
      lowStock,
      overdueInvoices,
      expiringBatches,
      recurringDue,
      counts,
      total: lowStock.length + overdueInvoices.length + expiringBatches.length + recurringDue.length,
    };
  }

  /** Persist high-priority alerts as notifications so the bell feed shows them. */
  async notify(): Promise<{ created: number }> {
    const summary = await this.summary();
    let created = 0;
    const notifyOnLowStock = (await settingsRepository.get("prefs.notifyOnLowStock")) ?? true;
    const items = [
      ...(notifyOnLowStock ? summary.lowStock : []),
      ...summary.overdueInvoices,
      ...summary.expiringBatches.slice(0, 5),
      ...summary.recurringDue.slice(0, 5),
    ];
    for (const item of items) {
      const written = await notificationService.create({
        kind: item.severity === "danger" ? "error" : item.severity,
        title: item.title,
        message: item.message,
        resource: item.resource,
        resourceId: item.resourceId,
      });
      if (written) created += 1;
    }
    return { created };
  }

  private async lowStockAlerts(): Promise<AlertItem[]> {
    const products = await productRepository.findAll();
    const items = await stockItemRepository.findAll();
    const alerts: AlertItem[] = [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || !product.trackStock) continue;
      const level = product.reorderLevel ?? 0;
      if (level <= 0) continue;
      if (item.quantityOnHand <= level) {
        alerts.push({
          kind: "low-stock",
          severity: item.quantityOnHand <= 0 ? "danger" : "warning",
          title: "Low stock",
          message: `${product.name} is at ${Math.max(0, item.quantityOnHand)} units (reorder at ${level})`,
          resource: "product",
          resourceId: product.id,
        });
      }
    }
    return alerts.slice(0, 50);
  }

  private async overdueInvoiceAlerts(): Promise<AlertItem[]> {
    const invoices = await invoiceRepository.byType("sales");
    const parties = await partyRepository.findAll();
    const alerts: AlertItem[] = [];
    const now = new Date();
    for (const inv of invoices) {
      if (!inv.dueDate) continue;
      const due = new Date(inv.dueDate);
      const balance = Math.round((inv.total - inv.paidAmount) * 100) / 100;
      if (balance <= 0) continue;
      const overdueDays = Math.floor((now.getTime() - due.getTime()) / DAY_MS);
      if (overdueDays < 1) continue;
      const party = parties.find((p) => p.id === inv.customerId);
      alerts.push({
        kind: "overdue-invoice",
        severity: overdueDays >= 30 ? "danger" : "warning",
        title: "Overdue invoice",
        message: `${inv.number} — ${party?.name ?? "customer"} owes ${balance} ${inv.currency} (${overdueDays}d overdue)`,
        resource: "invoice",
        resourceId: inv.id,
        date: inv.dueDate,
      });
    }
    return alerts.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).slice(0, 50);
  }

  private async expiringBatchAlerts(): Promise<AlertItem[]> {
    const batches = await batchRepository.findAll();
    const products = await productRepository.findAll();
    const alerts: AlertItem[] = [];
    for (const batch of batches) {
      if (batch.quantity <= 0) continue;
      const days = daysUntil(batch.expiryDate);
      if (days === undefined || days > 30) continue;
      const product = products.find((p) => p.id === batch.productId);
      alerts.push({
        kind: "expiring-batch",
        severity: days <= 7 ? "danger" : "warning",
        title: "Batch expiring",
        message: `${product?.name ?? batch.productId} — batch ${batch.batchNumber} expires in ${Math.max(0, days)}d (${toDateString(batch.expiryDate)})`,
        resource: "batch",
        resourceId: batch.id,
        date: batch.expiryDate,
      });
    }
    return alerts.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).slice(0, 50);
  }

  private async recurringDueAlerts(): Promise<AlertItem[]> {
    const recurring = await recurringInvoiceRepository.findAll();
    const parties = await partyRepository.findAll();
    const alerts: AlertItem[] = [];
    const now = new Date();
    for (const rec of recurring) {
      if (!rec.isActive) continue;
      const next = new Date(rec.nextRunDate);
      const days = Math.ceil((next.getTime() - now.getTime()) / DAY_MS);
      if (days > 7) continue;
      const party = parties.find((p) => p.id === rec.partyId);
      alerts.push({
        kind: "recurring-due",
        severity: days < 0 ? "warning" : "info",
        title: "Recurring invoice due",
        message: `${rec.number} — ${party?.name ?? "party"} ${days < 0 ? `${Math.abs(days)}d overdue` : `due in ${days}d`} (${toDateString(rec.nextRunDate)})`,
        resource: "recurring",
        resourceId: rec.id,
        date: rec.nextRunDate,
      });
    }
    return alerts.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).slice(0, 50);
  }
}

export const alertService = new AlertService();