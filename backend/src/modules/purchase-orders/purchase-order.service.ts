import { AppError } from "../../core/errors/app-error.js";
import { purchaseOrderRepository } from "./purchase-order.repository.js";
import {
  poCreateSchema,
  poUpdateSchema,
  type PurchaseOrderCreateInput,
  type PurchaseOrderUpdateInput,
} from "./purchase-order.schema.js";
import type { PurchaseOrder, PurchaseOrderLine } from "./purchase-order.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { productRepository } from "../products/product.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { withTransaction } from "../../core/database/transaction.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ComputedLine {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

export class PurchaseOrderService {
  private async computeLines(lines: PurchaseOrderCreateInput["lines"]): Promise<ComputedLine[]> {
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
        receivedQty: 0,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate,
        lineTotal,
      });
    }
    return result;
  }

  private computeTotals(lines: ComputedLine[], discount: number) {
    const subtotal = round2(Math.max(0, lines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0)));
    const tax = round2(Math.max(0, lines.reduce((s, l) => s + l.lineTotal, 0) - subtotal));
    const total = round2(Math.max(0, subtotal + tax - discount));
    return { subtotal, tax, total };
  }

  private toEntityLine(line: ComputedLine): PurchaseOrderLine {
    return {
      ...line,
      id: crypto.randomUUID(),
      purchaseOrderId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async deriveStatus(po: PurchaseOrder): Promise<PurchaseOrder["status"]> {
    if (po.status === "cancelled" || po.status === "draft" || po.status === "pending") return po.status;
    const total = po.lines.reduce((s, l) => s + l.quantity, 0);
    const received = po.lines.reduce((s, l) => s + l.receivedQty, 0);
    if (total > 0 && received >= total) return "received";
    if (received > 0) return "partially_received";
    return "approved";
  }

  async create(input: PurchaseOrderCreateInput, audit: AuditContext): Promise<PurchaseOrder> {
    const validated = poCreateSchema.parse(input);
    if (validated.supplierId && !(await partyRepository.findById(validated.supplierId))) {
      throw AppError.badRequest("Supplier not found");
    }
    if (validated.warehouseId && !(await warehouseRepository.findById(validated.warehouseId))) {
      throw AppError.badRequest("Warehouse not found");
    }

    return withTransaction(async () => {
      const lines = await this.computeLines(validated.lines);
      const { subtotal, tax, total } = this.computeTotals(lines, validated.discount ?? 0);
      const number = await purchaseOrderRepository.nextNumber();
      const principalId = audit.principal?.sub ?? "system";

      const po = await purchaseOrderRepository.create({
        data: {
          number,
          supplierId: validated.supplierId,
          warehouseId: validated.warehouseId,
          orderDate: validated.orderDate,
          expectedDate: validated.expectedDate,
          status: "draft",
          subtotal,
          discount: validated.discount ?? 0,
          tax,
          total,
          currency: validated.currency ?? "EGP",
          notes: validated.notes,
          createdBy: principalId,
          lines: lines.map((l) => this.toEntityLine(l)),
        },
      });

      await auditService.log(audit, "create:purchase-order", "purchase", po.id, { number });
      await notificationService.create({
        kind: "success",
        title: "Purchase order created",
        message: `${po.number} — ${total} ${po.currency}`,
        resource: "purchase-order",
        resourceId: po.id,
        actor: audit.principal,
      });
      return po;
    });
  }

  async update(id: string, input: PurchaseOrderUpdateInput, audit: AuditContext): Promise<PurchaseOrder> {
    const existing = await purchaseOrderRepository.findById(id);
    if (!existing) throw AppError.notFound("purchase order not found");
    if (existing.status === "cancelled") throw AppError.conflict("Cannot update a cancelled purchase order");
    if (existing.status === "received") throw AppError.conflict("Cannot update a fully received purchase order");
    if (input.supplierId && !(await partyRepository.findById(input.supplierId))) {
      throw AppError.badRequest("Supplier not found");
    }

    return withTransaction(async () => {
      const validated = poUpdateSchema.parse(input);
      const lines = validated.lines ? await this.computeLines(validated.lines) : undefined;
      const discount = validated.discount ?? existing.discount;
      let subtotal = existing.subtotal;
      let tax = existing.tax;
      let total = existing.total;
      if (lines) {
        const totals = this.computeTotals(lines, discount);
        subtotal = totals.subtotal;
        tax = totals.tax;
        total = totals.total;
      } else if (validated.discount !== undefined) {
        total = Math.max(0, round2(subtotal + tax - discount));
      }

      const updated = await purchaseOrderRepository.update({
        id,
        data: {
          supplierId: validated.supplierId,
          warehouseId: validated.warehouseId,
          orderDate: validated.orderDate,
          expectedDate: validated.expectedDate,
          lines: lines?.map((l) => this.toEntityLine(l)),
          subtotal,
          tax,
          total,
          discount,
          currency: validated.currency,
          notes: validated.notes,
        },
      });
      await auditService.log(audit, "update:purchase-order", "purchase", id);
      return updated as PurchaseOrder;
    });
  }

  async submit(id: string, audit: AuditContext): Promise<PurchaseOrder> {
    const po = await this.requireEditable(id);
    const updated = await purchaseOrderRepository.update({ id, data: { status: "pending" } });
    await auditService.log(audit, "submit:purchase-order", "purchase", id);
    return updated as PurchaseOrder;
  }

  async approve(id: string, audit: AuditContext): Promise<PurchaseOrder> {
    const po = await this.requireEditable(id);
    if (po.status !== "pending" && po.status !== "draft") {
      throw AppError.conflict(`Cannot approve a purchase order in status "${po.status}"`);
    }
    const updated = await purchaseOrderRepository.update({
      id,
      data: {
        status: "approved",
        approvedBy: audit.principal?.sub ?? "system",
        approvedAt: new Date().toISOString(),
      },
    });
    await auditService.log(audit, "approve:purchase-order", "purchase", id);
    await notificationService.create({
      kind: "success",
      title: "Purchase order approved",
      message: `${po.number} — approved`,
      resource: "purchase-order",
      resourceId: id,
      actor: audit.principal,
    });
    return updated as PurchaseOrder;
  }

  async cancel(id: string, audit: AuditContext): Promise<PurchaseOrder> {
    const po = await this.requireEditable(id);
    if (po.status === "received") throw AppError.conflict("Cannot cancel a fully received purchase order");
    const updated = await purchaseOrderRepository.update({ id, data: { status: "cancelled" } });
    await auditService.log(audit, "cancel:purchase-order", "purchase", id);
    return updated as PurchaseOrder;
  }

  /**
   * 3-way matching: receiving a purchase order creates a purchase invoice from
   * the ordered quantities, marks the received quantities on the PO, applies
   * stock, and updates the PO status (approved → partially_received → received).
   */
  async receive(id: string, input: { quantities?: Record<string, number> }, audit: AuditContext): Promise<{ po: PurchaseOrder; invoiceId?: string }> {
    const po = await purchaseOrderRepository.findById(id);
    if (!po) throw AppError.notFound("purchase order not found");
    if (po.status !== "approved" && po.status !== "partially_received") {
      throw AppError.conflict(`Purchase order must be approved before receiving (current: "${po.status}")`);
    }
    if (!po.warehouseId) throw AppError.badRequest("The purchase order needs a warehouse to receive goods");
    if (!(await warehouseRepository.findById(po.warehouseId))) throw AppError.badRequest("Warehouse not found");

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";
      const quantities = input.quantities ?? {};
      let anyReceived = false;

      const lines = po.lines.map((line) => {
        const qty = quantities[line.id] ?? line.quantity - line.receivedQty;
        const delta = Math.min(qty, line.quantity - line.receivedQty);
        if (delta > 0) anyReceived = true;
        return { ...line, receivedQty: round2(line.receivedQty + delta) };
      });
      if (!anyReceived) throw AppError.badRequest("Nothing to receive — no quantities were provided");

      // Build the purchase invoice lines from the received quantities.
      const invoiceLines = lines
        .filter((l) => l.receivedQty > 0 && l.quantity > 0)
        .map((l) => {
          const ratio = l.receivedQty / l.quantity;
          const receivedLineTotal = round2(l.lineTotal * ratio);
          return {
            id: crypto.randomUUID(),
            productId: l.productId,
            productName: l.productName,
            description: l.description,
            quantity: l.receivedQty,
            unitPrice: l.unitPrice,
            discount: round2(l.discount * ratio),
            taxRate: l.taxRate,
            lineTotal: receivedLineTotal,
          };
        });
      if (invoiceLines.length === 0) throw AppError.badRequest("No receivable lines on this purchase order");

      const subtotal = round2(invoiceLines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0));
      const tax = round2(invoiceLines.reduce((s, l) => s + l.lineTotal, 0) - subtotal);
      const discountRatio = po.subtotal > 0 ? subtotal / po.subtotal : 0;
      const discount = round2(po.discount * discountRatio);
      const total = round2(Math.max(0, subtotal + tax - discount));
      const number = await invoiceRepository.nextNumber("purchase");

      const invoice = await invoiceRepository.create({
        data: {
          type: "purchase",
          number,
          supplierId: po.supplierId,
          invoiceDate: new Date().toISOString(),
          warehouseId: po.warehouseId,
          lines: invoiceLines,
          subtotal,
          discount,
          tax,
          total,
          paidAmount: 0,
          currency: po.currency,
          received: true,
          status: "issued",
          notes: `Generated from purchase order ${po.number}`,
          purchaseOrderId: po.id,
          createdBy: principalId,
        },
      });

      // Apply stock-in for the received quantities.
      for (const line of invoiceLines) {
        if (line.productId) {
          const { applyLineStock, recordBatch } = await import("../inventory/inventory.service.js");
          await applyLineStock(line.productId, po.warehouseId!, line.quantity, principalId, {
            direction: "in",
            type: "purchase",
            referenceId: invoice.id,
            cost: line.unitPrice,
            actor: audit.principal,
          });
          await recordBatch({
            productId: line.productId,
            warehouseId: po.warehouseId!,
            batchNumber: invoice.number,
            quantity: line.quantity,
            createdBy: principalId,
          });
        }
      }

      const status = await this.deriveStatus({ ...po, lines, status: po.status });
      await purchaseOrderRepository.update({
        id,
        data: { lines, status },
      });

      await auditService.log(audit, "receive:purchase-order", "purchase", id, { invoiceId: invoice.id });
      await notificationService.create({
        kind: "success",
        title: "Purchase order received",
        message: `${po.number} — received; invoice ${number} created`,
        resource: "purchase-order",
        resourceId: id,
        actor: audit.principal,
      });
      return { po: (await purchaseOrderRepository.findById(id))!, invoiceId: invoice.id };
    });
  }

  async getById(id: string): Promise<PurchaseOrder> {
    const po = await purchaseOrderRepository.findById(id);
    if (!po) throw AppError.notFound("purchase order not found");
    return po;
  }

  async list(options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    filters?: Record<string, string[]>;
  }): Promise<{ items: PurchaseOrder[]; total: number; page: number; limit: number; totalPages: number }> {
    return purchaseOrderRepository.list({
      ...options,
      searchFields: ["number", "notes"],
    });
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const po = await purchaseOrderRepository.findById(id);
    if (!po) throw AppError.notFound("purchase order not found");
    if (po.status === "received" || po.status === "partially_received") {
      throw AppError.conflict("Cannot delete a purchase order that has been received");
    }
    await purchaseOrderRepository.delete(id);
    await auditService.log(audit, "delete:purchase-order", "purchase", id);
    return { id };
  }

  /** Enrich with supplier + warehouse names. */
  async enrich(po: PurchaseOrder) {
    const supplier = po.supplierId ? await partyRepository.findById(po.supplierId) : undefined;
    const warehouse = po.warehouseId ? await warehouseRepository.findById(po.warehouseId) : undefined;
    const received = po.lines.reduce((s, l) => s + l.receivedQty, 0);
    const ordered = po.lines.reduce((s, l) => s + l.quantity, 0);
    return {
      ...po,
      supplierName: supplier?.name,
      warehouseName: warehouse?.name,
      orderedQty: ordered,
      receivedQty: received,
    };
  }

  private async requireEditable(id: string): Promise<PurchaseOrder> {
    const po = await purchaseOrderRepository.findById(id);
    if (!po) throw AppError.notFound("purchase order not found");
    if (po.status === "cancelled") throw AppError.conflict("Purchase order is cancelled");
    return po;
  }
}

export const purchaseOrderService = new PurchaseOrderService();