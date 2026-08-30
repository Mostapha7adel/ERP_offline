import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { DeliveryNote, DeliveryNoteLine } from "./delivery-note.entity.js";

type Row = Record<string, unknown>;

export class DeliveryNoteRepository extends PrismaRepository<DeliveryNote> {
  protected model = "deliveryNote";
  protected searchFields = ["number", "receivedBy", "notes"];
  protected include = { lines: true };

  protected toEntity(row: Row): DeliveryNote {
    return {
      id: String(row.id),
      companyId: String(row.companyId),
      number: String(row.number),
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      partyId: row.partyId ? String(row.partyId) : undefined,
      warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
      deliveryDate: this.toISO(row.deliveryDate)!,
      status: row.status as DeliveryNote["status"],
      receivedBy: row.receivedBy ? String(row.receivedBy) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      deletedAt: row.deletedAt ? this.toISO(row.deletedAt) : undefined,
    };
  }

  async findByNumber(number: string): Promise<DeliveryNote | undefined> {
    const all = await this.findAll();
    return all.find((d) => d.number.toLowerCase() === number.toLowerCase());
  }

  async findByInvoiceId(invoiceId: string): Promise<DeliveryNote[]> {
    const all = await this.findAll();
    return all.filter((d) => d.invoiceId === invoiceId);
  }
}

export class DeliveryNoteLineRepository extends PrismaRepository<DeliveryNoteLine> {
  protected model = "deliveryNoteLine";
  protected searchFields = ["productName", "description"];

  protected toEntity(row: Row): DeliveryNoteLine {
    return {
      id: String(row.id),
      deliveryNoteId: String(row.deliveryNoteId),
      productId: row.productId ? String(row.productId) : undefined,
      productName: String(row.productName),
      description: row.description ? String(row.description) : undefined,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
      lineTotal: Number(row.lineTotal),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
      deletedAt: row.deletedAt ? this.toISO(row.deletedAt) : undefined,
    };
  }

  async findByDeliveryNoteId(deliveryNoteId: string): Promise<DeliveryNoteLine[]> {
    const all = await this.findAll();
    return all.filter((l) => l.deliveryNoteId === deliveryNoteId);
  }
}

export const deliveryNoteRepository = new DeliveryNoteRepository();
export const deliveryNoteLineRepository = new DeliveryNoteLineRepository();
