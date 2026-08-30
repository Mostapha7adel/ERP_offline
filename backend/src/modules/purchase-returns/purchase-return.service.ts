import { AppError } from "../../core/errors/app-error.js";
import { purchaseReturnRepository } from "./purchase-return.repository.js";
import {
  purchaseReturnCreateSchema,
  purchaseReturnUpdateSchema,
  type PurchaseReturnCreateInput,
  type PurchaseReturnUpdateInput,
} from "./purchase-return.schema.js";
import type { PurchaseReturn, PurchaseReturnLine } from "./purchase-return.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { productRepository } from "../products/product.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import { applyLineStock } from "../inventory/inventory.service.js";
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
}

export class PurchaseReturnService {
  private async computeLines(lines: PurchaseReturnCreateInput["lines"]): Promise<ComputedLine[]> {
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

  private toEntityLine(line: ComputedLine): PurchaseReturnLine {
    return { ...line, id: crypto.randomUUID() };
  }

  async create(input: PurchaseReturnCreateInput, audit: AuditContext): Promise<PurchaseReturn> {
    const validated = purchaseReturnCreateSchema.parse(input);

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";

      // Resolve the linked invoice
      let invoice;
      if (validated.invoiceId) {
        invoice = await invoiceRepository.findById(validated.invoiceId);
        if (!invoice) throw AppError.badRequest("Invoice not found");
        if (invoice.type !== "purchase") throw AppError.badRequest("Purchase returns must reference a purchase invoice");
        if (invoice.status === "void") throw AppError.conflict("Cannot add a return to a void invoice");
      }

      // Resolve the supplier: from the invoice when linked, otherwise explicit.
      let supplierId = validated.supplierId;
      if (invoice) {
        supplierId = invoice.supplierId ?? undefined;
      }
      if (!supplierId) throw AppError.badRequest("supplierId is required");
      const supplier = await partyRepository.findById(supplierId);
      if (!supplier) throw AppError.badRequest("Supplier not found");
      if (supplier.type !== "supplier") throw AppError.badRequest("Purchase returns must reference a supplier");

      // Warehouse: explicit, else the linked invoice's warehouse.
      const warehouseId = validated.warehouseId ?? invoice?.warehouseId;
      if (warehouseId && !(await warehouseRepository.findById(warehouseId))) {
        throw AppError.badRequest("Warehouse not found");
      }

      const lines = await this.computeLines(validated.lines);
      const { subtotal, tax, total } = this.computeTotals(lines, validated.discount ?? 0);
      const number = await purchaseReturnRepository.nextNumber();

      const returnRecord = await purchaseReturnRepository.create({
        data: {
          number,
          invoiceId: invoice?.id,
          supplierId,
          warehouseId,
          returnDate: validated.returnDate,
          lines: lines.map((l) => this.toEntityLine(l)),
          subtotal,
          discount: validated.discount ?? 0,
          tax,
          total,
          status: "issued",
          reason: validated.reason,
          notes: validated.notes,
          createdBy: principalId,
        },
      });

      // Reverse stock: purchase return removes goods from warehouse ("out")
      if (warehouseId) {
        for (const line of lines) {
          if (line.productId) {
            await applyLineStock(line.productId, warehouseId, line.quantity, principalId, {
              direction: "out",
              type: "return",
              referenceId: returnRecord.id,
              allowNegative: false,
              actor: audit.principal,
            });
          }
        }
      }

      // Adjust invoice: reduce invoice total and paidAmount if needed
      if (invoice) {
        const adjustedTotal = Math.max(0, round2(invoice.total - total));
        let paidAmount = invoice.paidAmount;
        if (paidAmount > adjustedTotal) paidAmount = adjustedTotal;
        const status = paidAmount >= adjustedTotal ? "paid" : paidAmount > 0 ? "partial" : "issued";
        await invoiceRepository.update({ id: invoice.id, data: { total: adjustedTotal, paidAmount, status } });
      }

      await auditService.log(audit, "create:purchase-return", "purchase-return", returnRecord.id, { number });
      await notificationService.create({
        kind: "success",
        title: "Purchase return created",
        message: `${returnRecord.number} — ${total}`,
        resource: "purchase-return",
        resourceId: returnRecord.id,
        actor: audit.principal,
      });

      return returnRecord;
    });
  }

  async update(id: string, input: PurchaseReturnUpdateInput, audit: AuditContext): Promise<PurchaseReturn> {
    const existing = await purchaseReturnRepository.findById(id);
    if (!existing) throw AppError.notFound("Purchase return not found");
    if (existing.status === "void") throw AppError.conflict("Cannot edit a voided return");
    const validated = purchaseReturnUpdateSchema.parse(input);

    const updated = await purchaseReturnRepository.update({
      id,
      data: {
        invoiceId: validated.invoiceId,
        supplierId: validated.supplierId,
        warehouseId: validated.warehouseId,
        returnDate: validated.returnDate,
        discount: validated.discount,
        reason: validated.reason,
        notes: validated.notes,
      },
    });

    await auditService.log(audit, "update:purchase-return", "purchase-return", id);
    return updated as PurchaseReturn;
  }

  async void(id: string, audit: AuditContext): Promise<PurchaseReturn> {
    const existing = await purchaseReturnRepository.findById(id);
    if (!existing) throw AppError.notFound("Purchase return not found");
    if (existing.status === "void") return existing;

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";

      // Reverse stock: put goods back into warehouse ("in")
      if (existing.warehouseId) {
        for (const line of existing.lines) {
          if (line.productId) {
            await applyLineStock(line.productId, existing.warehouseId, line.quantity, principalId, {
              direction: "in",
              type: "adjustment",
              referenceId: existing.id,
              allowNegative: false,
              actor: audit.principal,
            });
          }
        }
      }

      // Reverse invoice adjustment
      if (existing.invoiceId) {
        const invoice = await invoiceRepository.findById(existing.invoiceId);
        if (invoice && invoice.status !== "void") {
          const adjustedTotal = round2(invoice.total + existing.total);
          let paidAmount = invoice.paidAmount;
          if (paidAmount > adjustedTotal) paidAmount = adjustedTotal;
          const status = paidAmount >= adjustedTotal ? "paid" : paidAmount > 0 ? "partial" : "issued";
          await invoiceRepository.update({ id: invoice.id, data: { total: adjustedTotal, paidAmount, status } });
        }
      }

      const updated = await purchaseReturnRepository.update({ id, data: { status: "void" } });
      await auditService.log(audit, "void:purchase-return", "purchase-return", id, { number: existing.number });
      return updated as PurchaseReturn;
    });
  }

  async getById(id: string): Promise<PurchaseReturn> {
    const record = await purchaseReturnRepository.findById(id);
    if (!record) throw AppError.notFound("Purchase return not found");
    return record;
  }

  async list(options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    filters?: Record<string, string[]>;
  }) {
    return purchaseReturnRepository.list({
      ...options,
      searchFields: ["number", "reason", "notes"],
    });
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await purchaseReturnRepository.findById(id);
    if (!existing) throw AppError.notFound("Purchase return not found");
    if (existing.status !== "void") {
      throw AppError.conflict("Void the return before deleting");
    }
    await purchaseReturnRepository.delete(id);
    await auditService.log(audit, "delete:purchase-return", "purchase-return", id);
    return { id };
  }

  async enrich(record: PurchaseReturn) {
    const supplier = record.supplierId ? await partyRepository.findById(record.supplierId) : undefined;
    const invoice = record.invoiceId ? await invoiceRepository.findById(record.invoiceId) : undefined;
    const warehouse = record.warehouseId ? await warehouseRepository.findById(record.warehouseId) : undefined;
    return {
      ...record,
      supplierName: supplier?.name,
      invoiceNumber: invoice?.number,
      warehouseName: warehouse?.name,
    };
  }
}

export const purchaseReturnService = new PurchaseReturnService();
