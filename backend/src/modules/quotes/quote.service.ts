import { AppError } from "../../core/errors/app-error.js";
import { quoteRepository } from "./quote.repository.js";
import { quoteCreateSchema, quoteUpdateSchema, type QuoteCreateInput, type QuoteUpdateInput } from "./quote.schema.js";
import type { Quote, QuoteLine } from "./quote.entity.js";
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

export class QuoteService {
  constructor(private readonly type: InvoiceType) {}

  private async assertParty(partyId: string): Promise<void> {
    const party = await partyRepository.findById(partyId);
    if (!party) throw AppError.badRequest("Party not found");
    if (party.type !== (this.type === "sales" ? "customer" : "supplier")) {
      throw AppError.badRequest(`A ${this.type === "sales" ? "customer" : "supplier"} is required for ${this.type} quotes`);
    }
  }

  private async computeLines(lines: QuoteCreateInput["lines"]): Promise<ComputedLine[]> {
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

  private toEntityLine(line: ComputedLine): QuoteLine {
    return { ...line, id: crypto.randomUUID() };
  }

  async create(input: QuoteCreateInput, audit: AuditContext): Promise<Quote> {
    const validated = quoteCreateSchema.parse(input);
    if (validated.type !== this.type) {
      throw AppError.badRequest(`Quote type mismatch: expected ${this.type}`);
    }
    await this.assertParty(validated.partyId);
    if (validated.warehouseId && !(await warehouseRepository.findById(validated.warehouseId))) {
      throw AppError.badRequest("Warehouse not found");
    }

    return withTransaction(async () => {
      const lines = await this.computeLines(validated.lines);
      const { subtotal, tax, total } = this.computeTotals(lines, validated.discount ?? 0);
      const number = await quoteRepository.nextNumber(this.type);
      const quote = await quoteRepository.create({
        data: {
          type: this.type,
          number,
          partyId: validated.partyId,
          quoteDate: validated.quoteDate,
          validUntil: validated.validUntil,
          warehouseId: validated.warehouseId,
          lines: lines.map((l) => this.toEntityLine(l)),
          subtotal,
          discount: validated.discount ?? 0,
          tax,
          total,
          status: "draft",
          notes: validated.notes,
          createdBy: audit.principal?.sub ?? "system",
        },
      });
      await auditService.log(audit, `create:${this.type}-quote`, this.type, quote.id, { number });
      await notificationService.create({
        kind: "info",
        title: this.type === "sales" ? "Quote created" : "Purchase quotation created",
        message: `${quote.number} — ${this.type === "sales" ? "sales quote" : "purchase quotation"}`,
        resource: "quote",
        resourceId: quote.id,
        actor: audit.principal,
      });
      return quote;
    });
  }

  async update(id: string, input: QuoteUpdateInput, audit: AuditContext): Promise<Quote> {
    const existing = await quoteRepository.findById(id);
    if (!existing) throw AppError.notFound("quote not found");
    if (existing.status === "converted") throw AppError.conflict("Cannot update a converted quote");

    const validated = quoteUpdateSchema.parse(input);
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

      const updated = await quoteRepository.update({
        id,
        data: {
          partyId: validated.partyId ?? existing.partyId,
          quoteDate: validated.quoteDate ?? existing.quoteDate,
          validUntil: validated.validUntil !== undefined ? validated.validUntil : existing.validUntil,
          warehouseId: validated.warehouseId !== undefined ? validated.warehouseId : existing.warehouseId,
          status: validated.status ?? existing.status,
          notes: validated.notes ?? existing.notes,
          lines,
          subtotal,
          tax,
          total,
          discount,
        },
      });
      if (!updated) throw AppError.notFound("quote not found");
      await auditService.log(audit, `update:${this.type}-quote`, this.type, id);
      return updated as Quote;
    });
  }

  /** Convert a quote into an invoice (sales → /sales, purchase → /purchases). */
  async convert(id: string, audit: AuditContext): Promise<{ quote: Quote; invoiceId: string }> {
    const quote = await quoteRepository.findById(id);
    if (!quote) throw AppError.notFound("quote not found");
    if (quote.status === "converted") throw AppError.conflict("Quote has already been converted");

    const invoiceService = createInvoiceService(this.type);
    const invoice = await invoiceService.create(
      {
        type: this.type,
        ...(this.type === "sales" ? { customerId: quote.partyId } : { supplierId: quote.partyId }),
        invoiceDate: new Date().toISOString(),
        warehouseId: quote.warehouseId,
        lines: quote.lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate,
        })),
        discount: quote.discount,
        notes: quote.notes,
        quoteId: quote.id,
      },
      audit,
    );

    const updated = await quoteRepository.update({
      id: quote.id,
      data: { status: "converted" },
    });
    if (!updated) throw AppError.notFound("quote not found");
    await auditService.log(audit, `convert:${this.type}-quote`, this.type, id, { invoiceId: invoice.id });
    return { quote: updated as Quote, invoiceId: invoice.id };
  }

  async delete(id: string, audit: AuditContext): Promise<boolean> {
    const quote = await quoteRepository.findById(id);
    if (!quote) throw AppError.notFound("quote not found");
    if (quote.status === "converted") throw AppError.conflict("Cannot delete a converted quote");
    await auditService.log(audit, `delete:${this.type}-quote`, this.type, id);
    return quoteRepository.delete(id);
  }

  async getById(id: string): Promise<Quote> {
    const quote = await quoteRepository.findById(id);
    if (!quote) throw AppError.notFound("quote not found");
    return quote;
  }

  async list(options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    filters?: Record<string, string[]>;
  }): Promise<{ items: Quote[]; total: number; page: number; limit: number; totalPages: number }> {
    return quoteRepository.list({
      ...options,
      filters: { ...(options.filters ?? {}), type: [this.type] },
      searchFields: ["number", "partyId"],
    });
  }

  async enrich(quote: Quote) {
    const party = quote.partyId ? await partyRepository.findById(quote.partyId) : undefined;
    const warehouse = quote.warehouseId ? await warehouseRepository.findById(quote.warehouseId) : undefined;
    return {
      ...quote,
      partyName: party?.name,
      warehouseName: warehouse?.name,
    };
  }
}

export function createQuoteService(type: InvoiceType): QuoteService {
  return new QuoteService(type);
}
