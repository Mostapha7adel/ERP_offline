import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { deliveryNoteRepository, deliveryNoteLineRepository } from "./delivery-note.repository.js";
import { invoiceRepository } from "../trade/invoice.repository.js";
import {
  deliveryNoteCreateSchema,
  deliveryNoteUpdateSchema,
  type DeliveryNoteCreateInput,
  type DeliveryNoteUpdateInput,
} from "./delivery-note.schema.js";
import type { DeliveryNote, DeliveryNoteLine } from "./delivery-note.entity.js";
import type { BaseEntity } from "../../core/repository/base-repository.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { withTransaction } from "../../core/database/transaction.js";
import { getDefaultCompanyId } from "../../core/database/company.js";
import { applyLineStock } from "../inventory/inventory.service.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function nextDeliveryNoteNumber(): Promise<string> {
  const all = await deliveryNoteRepository.findAll();
  const count = all.length + 1;
  return `DN-${String(count).padStart(4, "0")}`;
}

export class DeliveryNoteService extends CrudService<DeliveryNote, DeliveryNoteCreateInput, DeliveryNoteUpdateInput> {
  constructor() {
    super({
      repository: deliveryNoteRepository,
      resourceName: "delivery-note",
      createSchema: deliveryNoteCreateSchema,
      updateSchema: deliveryNoteUpdateSchema,
      searchFields: ["number", "receivedBy", "notes"],
      toEntity: async (input, existing) => {
        const inp = input as Record<string, unknown>;
        return {
          invoiceId: (inp.invoiceId as string | undefined) ?? existing?.invoiceId,
          partyId: (inp.partyId as string | undefined) ?? existing?.partyId,
          warehouseId: (inp.warehouseId as string | undefined) ?? existing?.warehouseId,
          deliveryDate: (inp.deliveryDate as string | undefined) ?? existing?.deliveryDate ?? new Date().toISOString(),
          status: existing?.status ?? "pending",
          receivedBy: (inp.receivedBy as string | undefined) ?? existing?.receivedBy,
          notes: (inp.notes as string | undefined) ?? existing?.notes,
        } as Omit<DeliveryNote, keyof BaseEntity>;
      },
      beforeDelete: async (id) => {
        const lines = await deliveryNoteLineRepository.findByDeliveryNoteId(id);
        for (const line of lines) {
          await deliveryNoteLineRepository.delete(line.id);
        }
      },
    });
  }

  override async create(input: DeliveryNoteCreateInput, audit: AuditContext): Promise<DeliveryNote> {
    const validated = deliveryNoteCreateSchema.parse(input);
    const companyId = await getDefaultCompanyId();
    const number = await nextDeliveryNoteNumber();

    return withTransaction(async () => {
      const deliveryDate = validated.deliveryDate ?? new Date().toISOString();

      let invoice = undefined;
      if (validated.invoiceId) {
        invoice = await invoiceRepository.findById(validated.invoiceId);
        if (!invoice) throw AppError.badRequest("Invoice not found");
      }

      const entity = await deliveryNoteRepository.create({
        data: {
          companyId,
          number,
          invoiceId: validated.invoiceId,
          partyId: validated.partyId ?? invoice?.customerId ?? invoice?.supplierId,
          warehouseId: validated.warehouseId ?? invoice?.warehouseId,
          deliveryDate,
          status: "pending",
          receivedBy: validated.receivedBy,
          notes: validated.notes,
          createdBy: audit.principal?.sub ?? "system",
        } as Omit<DeliveryNote, keyof BaseEntity>,
      });

      let subtotal = 0;
      for (const lineInput of validated.lines) {
        const lineTotal = round2(lineInput.quantity * lineInput.unitPrice);
        subtotal = round2(subtotal + lineTotal);
        await deliveryNoteLineRepository.create({
          data: {
            deliveryNoteId: entity.id,
            productId: lineInput.productId,
            productName: lineInput.productName,
            description: lineInput.description,
            quantity: lineInput.quantity,
            unitPrice: lineInput.unitPrice,
            lineTotal,
          } as Omit<DeliveryNoteLine, keyof BaseEntity>,
        });
      }

      await auditService.log(audit, "create:delivery-note", "delivery-note", entity.id, {
        number,
        invoiceId: validated.invoiceId,
        lineCount: validated.lines.length,
        subtotal,
      });

      return { ...entity, subtotal } as DeliveryNote;
    });
  }

  override async update(id: string, input: DeliveryNoteUpdateInput, audit: AuditContext): Promise<DeliveryNote> {
    const existing = await deliveryNoteRepository.findById(id);
    if (!existing) throw AppError.notFound("delivery note not found");

    if (input.status && input.status !== existing.status) {
      if (existing.status === "received") {
        throw AppError.badRequest("Cannot change status of a received delivery note");
      }
      if (existing.status === "cancelled") {
        throw AppError.badRequest("Cannot change status of a cancelled delivery note");
      }
    }

    return withTransaction(async () => {
      const data: Partial<Omit<DeliveryNote, keyof BaseEntity>> = {
        partyId: input.partyId ?? existing.partyId,
        warehouseId: input.warehouseId ?? existing.warehouseId,
        deliveryDate: input.deliveryDate ?? existing.deliveryDate,
        status: input.status ?? existing.status,
        receivedBy: input.receivedBy ?? existing.receivedBy,
        notes: input.notes ?? existing.notes,
      };

      const updated = await deliveryNoteRepository.update({ id, data });

      if (input.lines) {
        const oldLines = await deliveryNoteLineRepository.findByDeliveryNoteId(id);
        for (const line of oldLines) {
          await deliveryNoteLineRepository.delete(line.id);
        }
        for (const lineInput of input.lines) {
          const lineTotal = round2(lineInput.quantity * lineInput.unitPrice);
          await deliveryNoteLineRepository.create({
            data: {
              deliveryNoteId: id,
              productId: lineInput.productId,
              productName: lineInput.productName,
              description: lineInput.description,
              quantity: lineInput.quantity,
              unitPrice: lineInput.unitPrice,
              lineTotal,
            } as Omit<DeliveryNoteLine, keyof BaseEntity>,
          });
        }
      }

      if (input.status === "received" && existing.status !== "received") {
        const lines = await deliveryNoteLineRepository.findByDeliveryNoteId(id);
        for (const line of lines) {
          if (line.productId && existing.warehouseId) {
            try {
              await applyLineStock(
                line.productId,
                existing.warehouseId,
                line.quantity,
                audit.principal?.sub ?? "system",
                {
                  direction: "in",
                  type: "purchase",
                  referenceId: id,
                  cost: line.unitPrice,
                  actor: audit.principal,
                },
              );
            } catch {
              // Stock update failure should not block delivery note creation
            }
          }
        }
      }

      await auditService.log(audit, `update:delivery-note`, "delivery-note", id, {
        status: input.status,
        receivedBy: input.receivedBy,
      });

      return updated as DeliveryNote;
    });
  }

  async getByInvoiceId(invoiceId: string): Promise<DeliveryNote[]> {
    return deliveryNoteRepository.findByInvoiceId(invoiceId);
  }
}

export const deliveryNoteService = new DeliveryNoteService();
