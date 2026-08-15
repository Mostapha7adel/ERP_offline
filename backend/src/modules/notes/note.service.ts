import { AppError } from "../../core/errors/app-error.js";
import { noteRepository } from "./note.repository.js";
import { noteCreateSchema, type NoteCreateInput } from "./note.schema.js";
import type { TradeNote, TradeNoteLine, NoteInvoiceType, TradeNoteType } from "./note.entity.js";
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

export class NoteService {
  private async computeLines(lines: NoteCreateInput["lines"]): Promise<ComputedLine[]> {
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

  private toEntityLine(line: ComputedLine): TradeNoteLine {
    return { ...line, id: crypto.randomUUID() };
  }

  /** Which way stock moves for a given (type, noteType) pair.
   *  Sales credit + purchase debit restore goods (in); sales debit +
   *  purchase credit move goods out. */
  private stockDirection(type: NoteInvoiceType, noteType: TradeNoteType): "in" | "out" {
    const isReturnToUs = (type === "sales") === (noteType === "credit");
    return isReturnToUs ? "in" : "out";
  }

  /** Adjust the linked invoice: credit notes lower the total, debit notes raise it. */
  private async adjustInvoice(invoiceId: string, noteTotal: number, noteType: TradeNoteType): Promise<void> {
    const invoice = await invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.status === "void") return;
    const delta = noteType === "credit" ? -noteTotal : noteTotal;
    const adjustedTotal = Math.max(0, round2(invoice.total + delta));
    let paidAmount = invoice.paidAmount;
    if (paidAmount > adjustedTotal) paidAmount = adjustedTotal;
    const status = paidAmount >= adjustedTotal ? "paid" : paidAmount > 0 ? "partial" : "issued";
    await invoiceRepository.update({ id: invoice.id, data: { total: adjustedTotal, paidAmount, status } });
  }

  async create(input: NoteCreateInput, audit: AuditContext): Promise<TradeNote> {
    const validated = noteCreateSchema.parse(input);

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";

      // Resolve the linked invoice (its type must match the note type).
      let invoice;
      if (validated.invoiceId) {
        invoice = await invoiceRepository.findById(validated.invoiceId);
        if (!invoice) throw AppError.badRequest("Invoice not found");
        if (invoice.type !== validated.type) {
          throw AppError.badRequest(`A ${validated.type} note cannot be linked to a ${invoice.type} invoice`);
        }
        if (invoice.status === "void") throw AppError.conflict("Cannot add a note to a void invoice");
      }

      // Resolve the party: from the invoice when linked, otherwise explicit.
      let partyId = validated.partyId;
      if (invoice) {
        partyId = invoice.type === "sales" ? invoice.customerId : invoice.supplierId;
      }
      if (!partyId) throw AppError.badRequest(`partyId is required for ${validated.type} notes`);
      const party = await partyRepository.findById(partyId);
      if (!party) throw AppError.badRequest("Party not found");
      if (validated.type === "sales" && party.type !== "customer") {
        throw AppError.badRequest("Sales notes must reference a customer");
      }
      if (validated.type === "purchase" && party.type !== "supplier") {
        throw AppError.badRequest("Purchase notes must reference a supplier");
      }

      // Warehouse: explicit, else the linked invoice's warehouse.
      const warehouseId = validated.warehouseId ?? invoice?.warehouseId;
      if (warehouseId && !(await warehouseRepository.findById(warehouseId))) {
        throw AppError.badRequest("Warehouse not found");
      }

      const lines = await this.computeLines(validated.lines);
      const { subtotal, tax, total } = this.computeTotals(lines, validated.discount ?? 0);
      const number = await noteRepository.nextNumber(validated.type, validated.noteType);

      const note = await noteRepository.create({
        data: {
          type: validated.type,
          noteType: validated.noteType,
          number,
          invoiceId: invoice?.id,
          partyId,
          warehouseId,
          noteDate: validated.noteDate,
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

      // Apply the stock effect (restore or remove goods per direction).
      const direction = this.stockDirection(validated.type, validated.noteType);
      if (warehouseId) {
        for (const line of lines) {
          if (line.productId) {
            await applyLineStock(line.productId, warehouseId, line.quantity, principalId, {
              direction,
              type: "return",
              referenceId: note.id,
              allowNegative: direction === "out",
              actor: audit.principal,
            });
          }
        }
      }

      if (invoice) {
        await this.adjustInvoice(invoice.id, total, validated.noteType);
      }

      await auditService.log(audit, `create:${validated.type}-${validated.noteType}-note`, "note", note.id, { number });
      await notificationService.create({
        kind: "success",
        title: validated.noteType === "credit" ? "Credit note issued" : "Debit note issued",
        message: `${note.number} — ${validated.type === "sales" ? "sales" : "purchase"} ${validated.noteType} note`,
        resource: "note",
        resourceId: note.id,
        actor: audit.principal,
      });

      return note;
    });
  }

  async void(id: string, audit: AuditContext): Promise<TradeNote> {
    const note = await noteRepository.findById(id);
    if (!note) throw AppError.notFound("note not found");
    if (note.status === "void") return note;

    return withTransaction(async () => {
      const principalId = audit.principal?.sub ?? "system";

      // Reverse the stock effect.
      const direction = this.stockDirection(note.type, note.noteType);
      if (note.warehouseId) {
        for (const line of note.lines) {
          if (line.productId) {
            await applyLineStock(line.productId, note.warehouseId, line.quantity, principalId, {
              direction: direction === "in" ? "out" : "in",
              type: "adjustment",
              referenceId: note.id,
              allowNegative: direction === "in",
              actor: audit.principal,
            });
          }
        }
      }

      // Reverse the invoice adjustment.
      if (note.invoiceId) {
        const invoice = await invoiceRepository.findById(note.invoiceId);
        if (invoice && invoice.status !== "void") {
          const delta = note.noteType === "credit" ? note.total : -note.total;
          const adjustedTotal = Math.max(0, round2(invoice.total + delta));
          let paidAmount = invoice.paidAmount;
          if (paidAmount > adjustedTotal) paidAmount = adjustedTotal;
          const status = paidAmount >= adjustedTotal ? "paid" : paidAmount > 0 ? "partial" : "issued";
          await invoiceRepository.update({ id: invoice.id, data: { total: adjustedTotal, paidAmount, status } });
        }
      }

      const updated = await noteRepository.update({ id, data: { status: "void" } });
      await auditService.log(audit, `void:${note.type}-${note.noteType}-note`, "note", id, { number: note.number });
      await notificationService.create({
        kind: "warning",
        title: "Credit/debit note voided",
        message: `${note.number} — cancelled`,
        resource: "note",
        resourceId: id,
        actor: audit.principal,
      });
      return updated as TradeNote;
    });
  }

  async getById(id: string): Promise<TradeNote> {
    const note = await noteRepository.findById(id);
    if (!note) throw AppError.notFound("note not found");
    return note;
  }

  async list(options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    filters?: Record<string, string[]>;
  }): Promise<{ items: TradeNote[]; total: number; page: number; limit: number; totalPages: number }> {
    return noteRepository.list({
      ...options,
      searchFields: ["number", "reason", "notes"],
    });
  }

  /** Enrich a note with party, invoice and warehouse names for the frontend. */
  async enrich(note: TradeNote) {
    const party = note.partyId ? await partyRepository.findById(note.partyId) : undefined;
    const invoice = note.invoiceId ? await invoiceRepository.findById(note.invoiceId) : undefined;
    const warehouse = note.warehouseId ? await warehouseRepository.findById(note.warehouseId) : undefined;
    return {
      ...note,
      partyName: party?.name,
      invoiceNumber: invoice?.number,
      warehouseName: warehouse?.name,
    };
  }
}

export function createNoteService(): NoteService {
  return new NoteService();
}
