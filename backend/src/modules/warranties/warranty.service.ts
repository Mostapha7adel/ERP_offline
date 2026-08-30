import { AppError } from "../../core/errors/app-error.js";
import { warrantyRepository } from "./warranty.repository.js";
import { warrantyCreateSchema, type WarrantyCreateInput } from "./warranty.schema.js";
import type { Warranty } from "./warranty.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { productRepository } from "../products/product.repository.js";
import { partyRepository } from "../parties/party.repository.js";

export class WarrantyService {
  async create(input: WarrantyCreateInput, audit: AuditContext): Promise<Warranty> {
    const validated = warrantyCreateSchema.parse(input);
    const principalId = audit.principal?.sub ?? "system";

    if (!(await productRepository.findById(validated.productId))) {
      throw AppError.badRequest("Product not found");
    }
    if (!(await partyRepository.findById(validated.customerId))) {
      throw AppError.badRequest("Customer not found");
    }

    const existing = await warrantyRepository.findOne(
      (w) => w.warrantyNumber === validated.warrantyNumber,
    );
    if (existing) throw AppError.conflict("Warranty number already exists");

    const warranty = await warrantyRepository.create({
      data: {
        productId: validated.productId,
        serialNumberId: validated.serialNumberId,
        customerId: validated.customerId,
        warrantyNumber: validated.warrantyNumber,
        startDate: validated.startDate,
        endDate: validated.endDate,
        status: "ACTIVE",
        invoiceId: validated.invoiceId,
        notes: validated.notes,
      } as any,
    });

    void auditService.log(audit, "create:warranty", "warranty", warranty.id, {
      productId: validated.productId,
      customerId: validated.customerId,
    });

    return warranty;
  }

  async claim(warrantyId: string, notes: string | undefined, audit: AuditContext): Promise<Warranty> {
    const warranty = await warrantyRepository.findById(warrantyId);
    if (!warranty) throw AppError.notFound("Warranty not found");
    if (warranty.status !== "ACTIVE") throw AppError.badRequest("Only ACTIVE warranties can be claimed");

    const updated = await warrantyRepository.update({
      id: warrantyId,
      data: {
        status: "CLAIMED",
        notes: notes ?? warranty.notes,
      },
    });

    void auditService.log(audit, "claim:warranty", "warranty", warrantyId, { notes });
    return updated as Warranty;
  }

  async delete(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await warrantyRepository.findById(id);
    if (!existing) throw AppError.notFound("Warranty not found");
    await warrantyRepository.delete(id);
    void auditService.log(audit, "delete:warranty", "warranty", id);
    return { id };
  }

  async getById(id: string): Promise<Warranty> {
    const warranty = await warrantyRepository.findById(id);
    if (!warranty) throw AppError.notFound("Warranty not found");
    return warranty;
  }

  async list(options: { page?: number; limit?: number; search?: string; filters?: Record<string, string[]> } = {}) {
    return warrantyRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["warrantyNumber", "notes"],
      filters: options.filters,
    });
  }

  async autoCreateForInvoice(invoiceId: string, audit: AuditContext): Promise<Warranty[]> {
    const { invoiceRepository } = await import("../trade/invoice.repository.js");
    const invoice = await invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.type !== "sales") return [];

    const created: Warranty[] = [];
    for (const line of invoice.lines) {
      if (!line.productId) continue;
      const product = await productRepository.findById(line.productId);
      if (!product || !product.warrantyPeriodDays || product.warrantyPeriodDays <= 0) continue;

      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + product.warrantyPeriodDays * 86400000).toISOString();
      const warrantyNumber = `WR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const warranty = await warrantyRepository.create({
        data: {
          productId: line.productId,
          customerId: invoice.customerId!,
          warrantyNumber,
          startDate,
          endDate,
          status: "ACTIVE",
          invoiceId,
        } as any,
      });

      created.push(warranty);
    }

    if (created.length > 0) {
      void auditService.log(audit, "auto-create:warranty", "warranty", invoiceId, { count: created.length });
    }

    return created;
  }
}

export const warrantyService = new WarrantyService();
