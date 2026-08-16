import { productRepository } from "../products/product.repository.js";
import { partyRepository } from "../parties/party.repository.js";
import { importProductsSchema, importPartiesSchema, type ImportProductRow, type ImportPartyRow } from "./import.schema.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export class ImportService {
  async importProducts(input: unknown, audit: AuditContext): Promise<ImportResult> {
    const validated = importProductsSchema.parse(input);
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < validated.rows.length; i++) {
      const row = validated.rows[i];
      try {
        const existing = await productRepository.findBySku(row.sku);
        if (existing) {
          if (validated.updateExisting) {
            await productRepository.update({
              id: existing.id,
              data: {
                name: row.name,
                description: row.description,
                category: row.category,
                brand: row.brand,
                unit: row.unit,
                purchasePrice: row.purchasePrice,
                salePrice: row.salePrice,
                taxRate: row.taxRate,
                trackStock: row.trackStock,
                reorderLevel: row.reorderLevel,
                barcode: row.barcode,
              },
            });
            result.updated += 1;
          } else {
            result.skipped += 1;
          }
        } else {
          await productRepository.create({
            data: {
              sku: row.sku,
              name: row.name,
              description: row.description,
              category: row.category,
              brand: row.brand,
              unit: row.unit,
              type: "product",
              purchasePrice: row.purchasePrice,
              salePrice: row.salePrice,
              taxRate: row.taxRate,
              trackStock: row.trackStock,
              reorderLevel: row.reorderLevel,
              barcode: row.barcode,
              status: "active",
            },
          });
          result.created += 1;
        }
      } catch (err) {
        result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : String(err) });
      }
    }

    void auditService.log(audit, "import:products", "catalog", undefined, {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
    });
    return result;
  }

  async importParties(input: unknown, audit: AuditContext): Promise<ImportResult> {
    const validated = importPartiesSchema.parse(input);
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < validated.rows.length; i++) {
      const row = validated.rows[i];
      try {
        const existing = await this.findPartyByLookup(row);
        if (existing) {
          if (validated.updateExisting) {
            await partyRepository.update({
              id: existing.id,
              data: {
                name: row.name,
                contactName: row.contactName,
                email: row.email,
                phone: row.phone,
                address: row.address,
                city: row.city,
                taxNumber: row.taxNumber,
                creditLimit: row.creditLimit,
                currency: row.currency,
              },
            });
            result.updated += 1;
          } else {
            result.skipped += 1;
          }
        } else {
          await partyRepository.create({
            data: {
              type: row.type,
              code: row.code ?? (await this.nextCode(row.type)),
              name: row.name,
              contactName: row.contactName,
              email: row.email,
              phone: row.phone,
              address: row.address,
              city: row.city,
              taxNumber: row.taxNumber,
              creditLimit: row.creditLimit,
              currency: row.currency,
              status: "active",
            },
          });
          result.created += 1;
        }
      } catch (err) {
        result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : String(err) });
      }
    }

    void auditService.log(audit, "import:parties", "parties", undefined, {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
    });
    return result;
  }

  private async findPartyByLookup(row: ImportPartyRow) {
    if (row.code) {
      const byCode = await partyRepository.findByCode(row.code, row.type);
      if (byCode) return byCode;
    }
    if (row.email) {
      const byEmail = await partyRepository.findByEmail(row.email);
      if (byEmail) return byEmail;
    }
    if (row.phone) {
      const byPhone = await partyRepository.findByPhone(row.phone);
      if (byPhone) return byPhone;
    }
    if (row.taxNumber) {
      const byTax = await partyRepository.findByTaxNumber(row.taxNumber);
      if (byTax) return byTax;
    }
    return undefined;
  }

  private async nextCode(type: "customer" | "supplier"): Promise<string> {
    const prefix = type === "customer" ? "CUST" : "SUPP";
    const all = await partyRepository.findAll();
    const count = all.filter((p) => p.type === type).length + 1;
    return `${prefix}-${String(count).padStart(4, "0")}`;
  }
}

export const importService = new ImportService();