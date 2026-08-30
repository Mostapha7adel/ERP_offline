import { AppError } from "../../core/errors/app-error.js";
import { serialNumberRepository } from "./serial-number.repository.js";
import { serialNumberCreateSchema, serialNumberBulkCreateSchema, type SerialNumberCreateInput, type SerialNumberBulkCreateInput } from "./serial-number.schema.js";
import type { SerialNumber } from "./serial-number.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";
import { productRepository } from "../products/product.repository.js";
import { warehouseRepository } from "../warehouses/warehouse.repository.js";

export class SerialNumberService {
  async create(input: SerialNumberCreateInput, audit: AuditContext): Promise<SerialNumber> {
    const validated = serialNumberCreateSchema.parse(input);

    if (!(await productRepository.findById(validated.productId))) {
      throw AppError.badRequest("Product not found");
    }
    if (!(await warehouseRepository.findById(validated.warehouseId))) {
      throw AppError.badRequest("Warehouse not found");
    }

    const existing = await serialNumberRepository.findBySerialNumber(
      audit.principal?.sub ?? "system",
      validated.serialNumber,
    );
    if (existing) throw AppError.conflict("Serial number already exists");

    const serial = await serialNumberRepository.create({
      data: {
        productId: validated.productId,
        serialNumber: validated.serialNumber,
        warehouseId: validated.warehouseId,
        status: validated.status ?? "IN_STOCK",
      },
    });

    void auditService.log(audit, "create:serial-number", "serial-number", serial.id, {
      productId: validated.productId,
      serialNumber: validated.serialNumber,
    });

    return serial;
  }

  async bulkCreate(input: SerialNumberBulkCreateInput, audit: AuditContext): Promise<SerialNumber[]> {
    const validated = serialNumberBulkCreateSchema.parse(input);

    if (!(await productRepository.findById(validated.productId))) {
      throw AppError.badRequest("Product not found");
    }
    if (!(await warehouseRepository.findById(validated.warehouseId))) {
      throw AppError.badRequest("Warehouse not found");
    }

    const created: SerialNumber[] = [];
    for (const sn of validated.serialNumbers) {
      const existing = await serialNumberRepository.findBySerialNumber(
        audit.principal?.sub ?? "system",
        sn,
      );
      if (existing) {
        throw AppError.conflict(`Serial number "${sn}" already exists`);
      }

      const serial = await serialNumberRepository.create({
        data: {
          productId: validated.productId,
          serialNumber: sn,
          warehouseId: validated.warehouseId,
          status: "IN_STOCK",
        },
      });
      created.push(serial);
    }

    void auditService.log(audit, "bulk-create:serial-number", "serial-number", undefined, {
      productId: validated.productId,
      count: created.length,
    });

    return created;
  }

  async assignToInvoice(serialNumberId: string, invoiceId: string, audit: AuditContext): Promise<SerialNumber> {
    const serial = await serialNumberRepository.findById(serialNumberId);
    if (!serial) throw AppError.notFound("Serial number not found");
    if (serial.status !== "IN_STOCK") throw AppError.badRequest("Serial number is not in stock");

    const updated = await serialNumberRepository.update({
      id: serialNumberId,
      data: { status: "SOLD", invoiceId },
    });

    void auditService.log(audit, "assign:serial-number", "serial-number", serialNumberId, { invoiceId });
    return updated as SerialNumber;
  }

  async returnSerial(serialNumberId: string, audit: AuditContext): Promise<SerialNumber> {
    const serial = await serialNumberRepository.findById(serialNumberId);
    if (!serial) throw AppError.notFound("Serial number not found");
    if (serial.status !== "SOLD") throw AppError.badRequest("Only SOLD serial numbers can be returned");

    const updated = await serialNumberRepository.update({
      id: serialNumberId,
      data: { status: "RETURNED", invoiceId: undefined },
    });

    void auditService.log(audit, "return:serial-number", "serial-number", serialNumberId);
    return updated as SerialNumber;
  }

  async getById(id: string): Promise<SerialNumber> {
    const serial = await serialNumberRepository.findById(id);
    if (!serial) throw AppError.notFound("Serial number not found");
    return serial;
  }

  async list(options: { page?: number; limit?: number; search?: string; filters?: Record<string, string[]> } = {}) {
    return serialNumberRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["serialNumber"],
      filters: options.filters,
    });
  }
}

export const serialNumberService = new SerialNumberService();
