import { AppError } from "../../core/errors/app-error.js";
import { recurringInvoiceRepository } from "./recurring.repository.js";
import {
  recurringCreateSchema,
  recurringUpdateSchema,
  type RecurringCreateInput,
  type RecurringUpdateInput,
} from "./recurring.schema.js";
import type { RecurringInvoice, RecurringInvoiceLine } from "./recurring.entity.js";
import type { InvoiceType } from "../trade/invoice.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { partyRepository } from "../parties/party.repository.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";
import { productRepository } from "../products/product.repository.js";
import { withTransaction } from "../../core/database/transaction.js";
import { createInvoiceService } from "../trade/invoice.service.js";

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

function addInterval(date: string, frequency: RecurringInvoice["frequency"], interval: number): string {
  const d = new Date(date);
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let next: Date;
  switch (frequency) {
    case "daily":
      next = new Date(base);
      next.setDate(base.getDate() + interval);
      break;
    case "weekly":
      next = new Date(base);
      next.setDate(base.getDate() + interval * 7);
      break;
    case "monthly":
      next = new Date(base.getFullYear(), base.getMonth() + interval, base.getDate());
      break;
    case "quarterly":
      next = new Date(base.getFullYear(), base.getMonth() + interval * 3, base.getDate());
      break;
    case "yearly":
      next = new Date(base.getFullYear() + interval, base.getMonth(), base.getDate());
      break;
    default:
      next = new Date(base);
  }
  return next.toISOString();
}

export class RecurringInvoiceService {
  constructor(private readonly type: InvoiceType) {}

  private async assertParty(partyId: string): Promise<void> {
    const party = await partyRepository.findById(partyId);
    if (!party) throw AppError.badRequest("Party not found");
    if (party.type !== (this.type === "sales" ? "customer" : "supplier")) {
      throw AppError.badRequest(`A ${this.type === "sales" ? "customer" : "supplier"} is required for ${this.type} recurring invoices`);
    }
  }

  private async computeLines(lines: RecurringCreateInput["lines"]): Promise<ComputedLine[]> {
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
      result.push({ productId, productName, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount, taxRate: line.taxRate, lineTotal });
    }
    return result;
  }

  private computeTotals(lines: ComputedLine[], discount: number) {
    const subtotal = round2(Math.max(0, lines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0)));
    const tax = round2(Math.max(0, lines.reduce((s, l) => s + l.lineTotal, 0) - subtotal));
    const total = round2(Math.max(0, subtotal + tax - discount));
    return { subtotal, tax, total };
  }

  private toEntityLine(line: ComputedLine): RecurringInvoiceLine {
    return { ...line, id: crypto.randomUUID() };
  }

  async create(input: RecurringCreateInput, audit: AuditContext): Promise<RecurringInvoice> {
    const validated = recurringCreateSchema.parse(input);
    if (validated.type !== this.type) throw AppError.badRequest(`Recurring type mismatch: expected ${this.type}`);
    await this.assertParty(validated.partyId);
    if (validated.warehouseId && !(await warehouseRepository.findById(validated.warehouseId))) {
      throw AppError.badRequest("Warehouse not found");
    }

    return withTransaction(async () => {
      const lines = await this.computeLines(validated.lines);
      const { subtotal, tax, total } = this.computeTotals(lines, validated.discount ?? 0);
      const number = await recurringInvoiceRepository.nextNumber(this.type);
      const recurring = await recurringInvoiceRepository.create({
        data: {
          type: this.type,
          number,
          partyId: validated.partyId,
          warehouseId: validated.warehouseId,
          frequency: validated.frequency,
          interval: validated.interval,
          nextRunDate: validated.nextRunDate,
          lines: lines.map((l) => this.toEntityLine(l)),
          subtotal,
          discount: validated.discount ?? 0,
          tax,
          total,
          isActive: true,
          notes: validated.notes,
          createdBy: audit.principal?.sub ?? "system",
        },
      });
      await auditService.log(audit, `create:${this.type}-recurring`, this.type, recurring.id, { number });
      return recurring;
    });
  }

  async update(id: string, input: RecurringUpdateInput, audit: AuditContext): Promise<RecurringInvoice> {
    const existing = await recurringInvoiceRepository.findById(id);
    if (!existing) throw AppError.notFound("recurring invoice not found");
    const validated = recurringUpdateSchema.parse(input);
    if (validated.partyId) await this.assertParty(validated.partyId);
    if (validated.warehouseId && !(await warehouseRepository.findById(validated.warehouseId))) {
      throw AppError.badRequest("Warehouse not found");
    }

    return withTransaction(async () => {
      let lines = existing.lines;
      let subtotal = existing.subtotal;
      let tax = existing.tax;
      const discount = validated.discount ?? existing.discount;
      let total = existing.total;

      if (validated.lines) {
        const computed = await this.computeLines(validated.lines);
        lines = computed.map((l) => this.toEntityLine(l));
        const totals = this.computeTotals(computed, discount);
        subtotal = totals.subtotal;
        tax = totals.tax;
        total = totals.total;
      } else if (validated.discount !== undefined) {
        total = Math.max(0, round2(subtotal + tax - discount));
      }

      const updated = await recurringInvoiceRepository.update({
        id,
        data: {
          partyId: validated.partyId ?? existing.partyId,
          warehouseId: validated.warehouseId !== undefined ? validated.warehouseId : existing.warehouseId,
          frequency: validated.frequency ?? existing.frequency,
          interval: validated.interval ?? existing.interval,
          nextRunDate: validated.nextRunDate ?? existing.nextRunDate,
          isActive: validated.isActive ?? existing.isActive,
          notes: validated.notes ?? existing.notes,
          lines,
          subtotal,
          tax,
          total,
          discount,
        },
      });
      if (!updated) throw AppError.notFound("recurring invoice not found");
      await auditService.log(audit, `update:${this.type}-recurring`, this.type, id);
      return updated as RecurringInvoice;
    });
  }

  /** Generate invoices for every active recurring template whose nextRunDate is due. */
  async runDue(audit: AuditContext): Promise<{ generated: number; invoices: string[] }> {
    const all = await recurringInvoiceRepository.findAll();
    const now = new Date();
    const due = all.filter((r) => r.isActive && r.type === this.type && new Date(r.nextRunDate) <= now);

    const invoices: string[] = [];
    for (const template of due) {
      const invoiceService = createInvoiceService(this.type);
      try {
        const invoice = await invoiceService.create(
          {
            type: this.type,
            ...(this.type === "sales" ? { customerId: template.partyId } : { supplierId: template.partyId }),
            invoiceDate: new Date().toISOString(),
            warehouseId: template.warehouseId,
            lines: template.lines.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              taxRate: l.taxRate,
            })),
            discount: template.discount,
            notes: template.notes,
          },
          audit,
        );
        await recurringInvoiceRepository.update({
          id: template.id,
          data: { lastRunAt: new Date().toISOString(), nextRunDate: addInterval(template.nextRunDate, template.frequency, template.interval) },
        });
        invoices.push(invoice.id);
      } catch {
        // Skip templates that fail (e.g. missing party) rather than aborting the run.
      }
    }

    if (invoices.length > 0) {
      await notificationService.create({
        kind: "info",
        title: this.type === "sales" ? "Recurring invoices generated" : "Recurring purchases generated",
        message: `${invoices.length} ${this.type === "sales" ? "sales" : "purchase"} invoice(s) generated automatically`,
        resource: "invoice",
        actor: audit.principal,
      });
    }
    return { generated: invoices.length, invoices };
  }

  async delete(id: string, audit: AuditContext): Promise<boolean> {
    const existing = await recurringInvoiceRepository.findById(id);
    if (!existing) throw AppError.notFound("recurring invoice not found");
    await auditService.log(audit, `delete:${this.type}-recurring`, this.type, id);
    return recurringInvoiceRepository.delete(id);
  }

  async getById(id: string): Promise<RecurringInvoice> {
    const recurring = await recurringInvoiceRepository.findById(id);
    if (!recurring) throw AppError.notFound("recurring invoice not found");
    return recurring;
  }

  async list(options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    filters?: Record<string, string[]>;
  }): Promise<{ items: RecurringInvoice[]; total: number; page: number; limit: number; totalPages: number }> {
    return recurringInvoiceRepository.list({
      ...options,
      filters: { ...(options.filters ?? {}), type: [this.type] },
      searchFields: ["number", "partyId"],
    });
  }

  async enrich(recurring: RecurringInvoice) {
    const party = recurring.partyId ? await partyRepository.findById(recurring.partyId) : undefined;
    const warehouse = recurring.warehouseId ? await warehouseRepository.findById(recurring.warehouseId) : undefined;
    return {
      ...recurring,
      partyName: party?.name,
      warehouseName: warehouse?.name,
    };
  }
}

export function createRecurringService(type: InvoiceType): RecurringInvoiceService {
  return new RecurringInvoiceService(type);
}
