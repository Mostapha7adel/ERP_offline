import { AppError } from "../../core/errors/app-error.js";
import { invoiceRepository } from "./invoice.repository.js";
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  type InvoiceCreateInput,
  type InvoiceUpdateInput,
} from "./invoice.schema.js";
import type { Invoice, InvoiceLine, InvoiceType } from "./invoice.entity.js";
import type { BaseEntity } from "../../core/repository/base-repository.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { productRepository } from "../products/product.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";
import { applyLineStock, recordBatch, consumeBatches } from "../inventory/inventory.service.js";
import { stockItemRepository } from "../inventory/inventory.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { withTransaction } from "../../core/database/transaction.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ComputedLine {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  batchNumber?: string;
  expiryDate?: string;
}

export class InvoiceService {
  constructor(private readonly type: InvoiceType) {}

  private async assertParty(invoiceType: InvoiceType, input: InvoiceCreateInput): Promise<void> {
    if (invoiceType === "sales") {
      if (!input.customerId) throw AppError.badRequest("customerId is required for sales invoices");
      if (!(await partyRepository.findById(input.customerId))) throw AppError.badRequest("Customer not found");
    } else {
      if (!input.supplierId) throw AppError.badRequest("supplierId is required for purchase invoices");
      if (!(await partyRepository.findById(input.supplierId))) throw AppError.badRequest("Supplier not found");
    }
  }

  /** Enforce the customer credit limit: outstanding balance + this invoice must not exceed it. */
  private async assertCreditLimit(party: { id: string; creditLimit?: number }, invoiceTotal: number): Promise<void> {
    const limit = party.creditLimit;
    if (!limit || limit <= 0) return;
    const outstanding = await this.customerOutstanding(party.id);
    const projected = outstanding + invoiceTotal;
    if (projected > limit) {
      throw AppError.badRequest(
        `Credit limit exceeded. Outstanding ${outstanding.toFixed(2)} + this invoice ${invoiceTotal.toFixed(2)} exceeds the customer limit of ${limit.toFixed(2)}.`,
      );
    }
  }

  /** Total unpaid balance of a customer's non-void sales invoices. */
  private async customerOutstanding(customerId: string): Promise<number> {
    const invoices = await invoiceRepository.byType("sales");
    return round2(
      invoices
        .filter((inv) => inv.customerId === customerId && inv.status !== "void")
        .reduce((sum, inv) => sum + Math.max(0, inv.total - inv.paidAmount), 0),
    );
  }

  private async computeLines(lines: InvoiceCreateInput["lines"]): Promise<ComputedLine[]> {
    const result: ComputedLine[] = [];
    for (const line of lines) {
      let productId = line.productId;
      let productName = line.productName;
      const product = line.productId ? await productRepository.findById(line.productId) : undefined;
      if (line.productId && !product) throw AppError.badRequest(`Product "${line.productId}" not found`);
      if (product) {
        productId = product.id;
        productName = product.name;
      }
      const gross = line.quantity * line.unitPrice - line.discount;
      const tax = gross * (line.taxRate / 100);
      const lineTotal = round2(Math.max(0, gross + tax));
      result.push({
        productId,
        productName,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate,
        lineTotal,
        batchNumber: line.batchNumber,
        expiryDate: line.expiryDate,
      });
    }
    return result;
  }

  private computeTotals(lines: ComputedLine[], discount: number) {
    const subtotal = round2(Math.max(0, lines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0)));
    const tax = round2(Math.max(0, lines.reduce((s, l) => s + l.lineTotal, 0) - subtotal));
    const total = round2(subtotal + tax - discount);
    return { subtotal, tax, total: Math.max(0, total) };
  }

  private toEntityLine(line: ComputedLine): InvoiceLine {
    return { ...line, id: crypto.randomUUID() };
  }

  async create(input: InvoiceCreateInput, audit: AuditContext): Promise<Invoice> {
    const validated = invoiceCreateSchema.parse(input);
    await this.assertParty(this.type, validated);

    return withTransaction(async () => {
      const lines = await this.computeLines(validated.lines);
      const { subtotal, tax, total } = this.computeTotals(lines, validated.discount ?? 0);
      const number = await invoiceRepository.nextNumber(this.type);
      const principalId = audit.principal?.sub ?? "system";

      // For sales: reduce inventory stock.
      // For purchases: increase inventory stock.
      if (validated.warehouseId && !(await warehouseRepository.findById(validated.warehouseId))) {
        throw AppError.badRequest("Warehouse not found");
      }

      // Resolve currency: explicit → party currency → company currency.
      let currency = validated.currency ?? "EGP";
      const partyId = this.type === "sales" ? validated.customerId : validated.supplierId;
      const party = partyId ? await partyRepository.findById(partyId) : undefined;
      if (party?.currency) currency = party.currency;

      // Credit-limit enforcement for sales invoices (opt-in setting).
      if (this.type === "sales" && party) {
        const { settingsRepository } = await import("../settings/settings.repository.js");
        const enforce = (await settingsRepository.get("prefs.enforceCreditLimit")) ?? false;
        if (enforce) {
          await this.assertCreditLimit(party, total);
        }
      }

      const invoice = await invoiceRepository.create({
        data: {
          type: this.type,
          number,
          customerId: this.type === "sales" ? validated.customerId : undefined,
          supplierId: this.type === "purchase" ? validated.supplierId : undefined,
          invoiceDate: validated.invoiceDate,
          dueDate: validated.dueDate,
          warehouseId: validated.warehouseId,
          lines: lines.map((l) => this.toEntityLine(l)),
          subtotal,
          discount: validated.discount ?? 0,
          tax,
          total,
          paidAmount: 0,
          currency,
          received: this.type === "purchase" ? Boolean(validated.received) : true,
          status: "issued",
          paymentMethod: validated.paymentMethod,
          notes: validated.notes,
          quoteId: validated.quoteId,
          purchaseOrderId: validated.purchaseOrderId,
          createdBy: principalId,
        },
      });

      // Sales: always reduce inventory immediately.
      // Purchases: only add inventory once the goods are received.
      const applyStock = this.type === "sales" || Boolean(validated.received);
      if (applyStock && validated.warehouseId) {
        const direction = this.type === "sales" ? "out" : "in";
        for (const line of lines) {
          if (line.productId) {
            const product = await productRepository.findById(line.productId);
            const cost = product?.purchasePrice ?? 0;
            await applyLineStock(line.productId, validated.warehouseId, line.quantity, principalId, {
              direction,
              type: this.type === "sales" ? "sale" : "purchase",
              referenceId: invoice.id,
              cost: this.type === "purchase" ? cost : undefined,
              actor: audit.principal,
            });
            if (this.type === "purchase") {
              await recordBatch({
                productId: line.productId,
                warehouseId: validated.warehouseId,
                batchNumber: line.batchNumber || invoice.number,
                quantity: line.quantity,
                expiryDate: line.expiryDate,
                unitCost: line.unitPrice,
                createdBy: principalId,
              });
            } else {
              await consumeBatches(line.productId, validated.warehouseId, line.quantity);
            }
          }
        }
      }

      await auditService.log(audit, `create:${this.type}-invoice`, this.type, invoice.id, { number });
      await notificationService.create({
        kind: "success",
        title: this.type === "sales" ? "Sale recorded" : "Purchase recorded",
        message: `${invoice.number} — ${this.type === "sales" ? "sale" : "purchase"}`,
        resource: "invoice",
        resourceId: invoice.id,
        actor: audit.principal,
      });

      // Pay the full amount at creation atomically (invoice + treasury
      // transaction + balance in the same transaction).
      if (validated.paidNow) {
        return this.applyPayment(invoice, invoice.total, validated.paymentMethod, validated.paymentAccountId, audit);
      }
      return invoice;
    });
  }

  async update(id: string, input: InvoiceUpdateInput, audit: AuditContext): Promise<Invoice> {
    const existing = await invoiceRepository.findById(id);
    if (!existing) throw AppError.notFound("invoice not found");
    if (existing.status === "void") throw AppError.conflict("Cannot update a void invoice");

    const validated = invoiceUpdateSchema.parse(input);

    if (this.type === "sales") {
      if (validated.customerId && !(await partyRepository.findById(validated.customerId))) {
        throw AppError.badRequest("Customer not found");
      }
    } else {
      if (validated.supplierId && !(await partyRepository.findById(validated.supplierId))) {
        throw AppError.badRequest("Supplier not found");
      }
    }
    const nextWarehouseId = validated.warehouseId ?? existing.warehouseId;
    if (nextWarehouseId && !(await warehouseRepository.findById(nextWarehouseId))) {
      throw AppError.badRequest("Warehouse not found");
    }

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";
      // Stock was applied when: sales always, purchases only once received.
      const prevWarehouseId = existing.warehouseId;
      const prevApplied = this.type === "sales" || existing.received;
      const linesChanged = Boolean(validated.lines);
      const warehouseChanged = nextWarehouseId !== prevWarehouseId;
      let lines = existing.lines;
      let subtotal = existing.subtotal;
      let tax = existing.tax;
      const discount = validated.discount ?? existing.discount;
      let total = existing.total;

      if (linesChanged) {
        const computed = await this.computeLines(validated.lines!);
        lines = computed.map((l) => this.toEntityLine(l));
        const totals = this.computeTotals(computed, discount);
        subtotal = totals.subtotal;
        tax = totals.tax;
        total = totals.total;
      } else if (validated.discount !== undefined) {
        // A discount-only change must recompute the total, otherwise the
        // persisted total diverges from subtotal + tax - discount.
        total = Math.max(0, round2(subtotal + tax - discount));
      }

      const finalReceived = validated.received ?? existing.received;
      const finalApplied = this.type === "sales" || finalReceived;

      // Restore the old stock effect before applying the new one whenever the
      // lines or the warehouse changed.
      if (prevWarehouseId && prevApplied && (linesChanged || warehouseChanged)) {
        for (const line of existing.lines) {
          if (line.productId) {
            await applyLineStock(line.productId, prevWarehouseId, line.quantity, principalId, {
              direction: this.type === "sales" ? "in" : "out",
              type: "adjustment",
              referenceId: existing.id,
              actor: audit.principal,
            });
          }
        }
      }
      if (nextWarehouseId && finalApplied && (linesChanged || warehouseChanged)) {
        for (const line of lines) {
          if (line.productId) {
            await applyLineStock(line.productId, nextWarehouseId, line.quantity, principalId, {
              direction: this.type === "sales" ? "out" : "in",
              type: "adjustment",
              referenceId: existing.id,
              allowNegative: this.type === "purchase",
              actor: audit.principal,
            });
          }
        }
      } else if (!linesChanged && !warehouseChanged && nextWarehouseId && prevApplied !== finalApplied) {
        // Only the received flag transitioned: apply or reverse stock so the
        // stored `received` flag and the actual stock level stay in sync.
        for (const line of lines) {
          if (line.productId) {
            await applyLineStock(line.productId, nextWarehouseId, line.quantity, principalId, {
              direction: finalApplied ? "in" : "out",
              type: finalApplied ? "purchase" : "adjustment",
              referenceId: existing.id,
              allowNegative: this.type === "purchase",
              actor: audit.principal,
            });
          }
        }
      }

      // Status is derived from the paid amount — a client can never mark an
      // invoice paid without an actual payment recorded against it.
      const status = existing.paidAmount >= total ? "paid" : existing.paidAmount > 0 ? "partial" : "issued";

      const updated = await invoiceRepository.update({
        id,
        data: {
          customerId: this.type === "sales" ? (validated.customerId ?? existing.customerId) : undefined,
          supplierId: this.type === "purchase" ? (validated.supplierId ?? existing.supplierId) : undefined,
          warehouseId: nextWarehouseId,
          invoiceDate: validated.invoiceDate ?? existing.invoiceDate,
          dueDate: validated.dueDate ?? existing.dueDate,
          received: finalReceived,
          notes: validated.notes ?? existing.notes,
          paymentMethod: validated.paymentMethod ?? existing.paymentMethod,
          lines,
          subtotal,
          tax,
          total,
          discount,
          status,
        },
      });

      await auditService.log(audit, `update:${this.type}-invoice`, this.type, id);
      return updated as Invoice;
    });
  }

  async registerPayment(id: string, amount: number, method: string | undefined, accountId: string | undefined, audit: AuditContext): Promise<Invoice> {
    if (amount <= 0) throw AppError.badRequest("Payment amount must be positive");

    // The read, validation and write happen inside the same transaction so two
    // concurrent payments can't both compute paidAmount from the same stale
    // snapshot (which would lose one payment while recording both balances).
    return withTransaction(async () => {
      const invoice = await invoiceRepository.findById(id);
      if (!invoice) throw AppError.notFound("invoice not found");
      if (invoice.status === "void") throw AppError.conflict("Cannot pay a void invoice");
      const paidAmount = round2(invoice.paidAmount + amount);
      if (paidAmount > invoice.total) throw AppError.badRequest("Payment exceeds invoice total");
      return this.applyPayment(invoice, amount, method, accountId, audit);
    });
  }

  /**
   * Apply a payment inside an active transaction: mark the invoice paid /
   * partially paid, record a treasury transaction against the resolved account
   * and update its balance. Must be called within `withTransaction`.
   */
  private async applyPayment(
    invoice: Invoice,
    amount: number,
    method: string | undefined,
    accountId: string | undefined,
    audit: AuditContext,
  ): Promise<Invoice> {
    const paidAmount = round2(invoice.paidAmount + amount);
    const status = paidAmount >= invoice.total ? "paid" : "partial";
    const updated = await invoiceRepository.update({ id: invoice.id, data: { paidAmount, status, paymentMethod: method } });

    // Record a treasury transaction against the selected account (or the
    // default cash account when none is specified) and update its balance.
    // An explicitly chosen account is never silently replaced.
    const {
      treasuryTransactionRepository,
      treasuryAccountRepository,
    } = await import("../treasury/treasury.repository.js");
    if (accountId) {
      const selected = await treasuryAccountRepository.findById(accountId);
      if (!selected) throw AppError.badRequest("The selected treasury account no longer exists");
    }
    const account = accountId
      ? (await treasuryAccountRepository.findById(accountId))!
      : await treasuryAccountRepository.findByName("Petty Cash")
        ?? await treasuryAccountRepository.findByName("Main Bank Account")
        ?? (await treasuryAccountRepository.findAll())[0];
    if (!account) {
      throw AppError.badRequest("No treasury account is configured. Create a cash or bank account before recording payments.");
    }
    if (!account.isActive) {
      throw AppError.badRequest(`Treasury account "${account.name}" is inactive`);
    }
    await treasuryTransactionRepository.create({
      data: {
        accountId: account.id,
        type: this.type === "sales" ? "income" : "expense",
        amount: round2(amount),
        category: this.type === "sales" ? "customer-payment" : "supplier-payment",
        partyType: this.type === "sales" ? "customer" : "supplier",
        partyId: (this.type === "sales" ? invoice.customerId : invoice.supplierId) ?? undefined,
        reference: invoice.number,
        referenceId: invoice.id,
        description: `${this.type === "sales" ? "Payment received" : "Payment made"} — ${invoice.number}`,
        date: new Date().toISOString(),
        createdBy: audit.principal?.sub ?? "system",
      },
    });
    {
      const delta = this.type === "sales" ? amount : -amount;
      await treasuryAccountRepository.update({
        id: account.id,
        data: { balance: round2(account.balance + delta) },
      });
    }

    await auditService.log(audit, `pay:${this.type}-invoice`, this.type, invoice.id, { amount });
    await notificationService.create({
      kind: "success",
      title: this.type === "sales" ? "Sale paid" : "Purchase paid",
      message: `${invoice.number} — paid ${amount}`,
      resource: "invoice",
      resourceId: invoice.id,
      actor: audit.principal,
    });
    return updated as Invoice;
  }

  async receive(id: string, warehouseId: string | undefined, audit: AuditContext): Promise<Invoice> {
    if (this.type !== "purchase") throw AppError.badRequest("Only purchase orders can be received");
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw AppError.notFound("invoice not found");
    if (invoice.status === "void") throw AppError.conflict("Cannot receive a void invoice");
    if (invoice.received) return invoice;

    const target = warehouseId ?? invoice.warehouseId;
    if (!target) throw AppError.badRequest("A warehouse is required to receive the goods");
    if (!(await warehouseRepository.findById(target))) throw AppError.badRequest("Warehouse not found");

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";
      for (const line of invoice.lines) {
        if (line.productId) {
          const product = await productRepository.findById(line.productId);
          const cost = product?.purchasePrice ?? 0;
          await applyLineStock(line.productId, target, line.quantity, principalId, {
            direction: "in",
            type: "purchase",
            referenceId: invoice.id,
            cost,
            actor: audit.principal,
          });
        }
      }
      const updated = await invoiceRepository.update({ id, data: { received: true, warehouseId: target } });
      if (!updated) throw AppError.notFound("invoice not found");
      await auditService.log(audit, "receive:purchase-invoice", this.type, id);
      await notificationService.create({
        kind: "success",
        title: "Purchase received",
        message: `${updated.number} — received into warehouse`,
        resource: "invoice",
        resourceId: id,
        actor: audit.principal,
      });
      return updated as Invoice;
    });
  }

  async void(id: string, audit: AuditContext): Promise<Invoice> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw AppError.notFound("invoice not found");
    if (invoice.status === "void") return invoice;

    return withTransaction(async () => {
      // Reverse stock effects (sales always reduce stock; purchases only
      // reverse when the goods had been received into a warehouse).
      const principalId = audit.principal?.sub ?? "system";
      if (invoice.warehouseId && (this.type === "sales" || invoice.received)) {
        for (const line of invoice.lines) {
          if (line.productId) {
            await applyLineStock(line.productId, invoice.warehouseId, line.quantity, principalId, {
              direction: this.type === "sales" ? "in" : "out",
              type: "return",
              referenceId: invoice.id,
              allowNegative: this.type === "purchase",
              actor: audit.principal,
            });
          }
        }
      }

      // Reverse any paid amounts: cancel the treasury transaction(s) recorded
      // for this invoice and restore the affected account balances. This
      // removes the income (sales) or expense (purchase) impact of the payment.
      if (invoice.paidAmount > 0) {
        const {
          treasuryTransactionRepository,
          treasuryAccountRepository,
        } = await import("../treasury/treasury.repository.js");
        const txns = await treasuryTransactionRepository.byInvoiceId(invoice.id);
        if (txns.length > 0) {
          // Restore each account balance by reversing its payment direction.
          const deltas = new Map<string, number>();
          for (const txn of txns) {
            const delta = txn.type === "income" ? -txn.amount : txn.type === "expense" ? +txn.amount : 0;
            deltas.set(txn.accountId, (deltas.get(txn.accountId) ?? 0) + delta);
          }
          for (const [accountId, delta] of deltas) {
            const account = await treasuryAccountRepository.findById(accountId);
            if (account) {
              await treasuryAccountRepository.update({
                id: accountId,
                data: { balance: round2(account.balance + delta) },
              });
            }
          }
          await treasuryTransactionRepository.deleteByInvoiceId(invoice.id);
        }
      }

      const updated = await invoiceRepository.update({ id, data: { status: "void", paidAmount: 0 } });
      await auditService.log(audit, `void:${this.type}-invoice`, this.type, id);
      await notificationService.create({
        kind: "warning",
        title: this.type === "sales" ? "Sale cancelled" : "Purchase cancelled",
        message: `${invoice.number} — cancelled`,
        resource: "invoice",
        resourceId: id,
        actor: audit.principal,
      });
      return updated as Invoice;
    });
  }

  async getById(id: string): Promise<Invoice> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw AppError.notFound("invoice not found");
    return invoice;
  }

  async list(options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    filters?: Record<string, string[]>;
  }): Promise<{ items: Invoice[]; total: number; page: number; limit: number; totalPages: number }> {
    const result = await invoiceRepository.list({
      ...options,
      filters: { ...(options.filters ?? {}), type: [this.type] },
      searchFields: ["number", "customerId", "supplierId"],
    });
    return result;
  }

  /** Enrich invoice with party + warehouse names for the frontend. */
  async enrich(invoice: Invoice) {
    const customer = invoice.customerId ? await partyRepository.findById(invoice.customerId) : undefined;
    const supplier = invoice.supplierId ? await partyRepository.findById(invoice.supplierId) : undefined;
    const warehouse = invoice.warehouseId ? await warehouseRepository.findById(invoice.warehouseId) : undefined;
    const balance = round2(invoice.total - invoice.paidAmount);
    return {
      ...invoice,
      customerName: customer?.name,
      supplierName: supplier?.name,
      warehouseName: warehouse?.name,
      balance,
    };
  }
}

export function createInvoiceService(type: InvoiceType): InvoiceService {
  return new InvoiceService(type);
}

export { stockItemRepository };
