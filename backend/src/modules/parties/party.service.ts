import { CrudService } from "../../core/service/crud-service.js";
import { AppError } from "../../core/errors/app-error.js";
import { partyRepository } from "./party.repository.js";
import { partyCreateSchema, partyUpdateSchema, type PartyCreateInput, type PartyUpdateInput } from "./party.schema.js";
import type { Party, PartyType } from "./party.entity.js";
import type { BaseEntity, ListOptions } from "../../core/repository/base-repository.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { invoiceRepository } from "../trade/invoice.repository.js";

async function makeCode(type: PartyType): Promise<string> {
  const prefix = type === "customer" ? "CUS" : "SUP";
  const count = (await partyRepository.findAll()).filter((p) => p.type === type).length + 1;
  return `${prefix}-${String(count).padStart(4, "0")}`;
}

export class PartyService extends CrudService<Party, PartyCreateInput, PartyUpdateInput> {
  constructor(private readonly partyType: PartyType) {
    super({
      repository: partyRepository,
      resourceName: partyType,
      createSchema: partyCreateSchema,
      updateSchema: partyUpdateSchema,
      searchFields: ["name", "code", "email", "phone", "taxNumber", "city", "contactName"],
      toEntity: async (input, existing) => {
        return {
          type: this.partyType,
          code: (input.code as string | undefined)?.toUpperCase() ?? existing?.code ?? (await makeCode(this.partyType)),
          name: input.name ?? existing?.name ?? "",
          contactName: input.contactName ?? existing?.contactName,
          email: input.email ? (input.email as string) : existing?.email,
          phone: input.phone ?? existing?.phone,
          address: input.address ?? existing?.address,
          city: input.city ?? existing?.city,
          taxNumber: input.taxNumber ?? existing?.taxNumber,
          creditLimit: input.creditLimit ?? existing?.creditLimit,
          currency: input.currency ?? existing?.currency ?? "USD",
          notes: input.notes ?? existing?.notes,
          status: input.status ?? existing?.status ?? "active",
        } as Omit<Party, keyof BaseEntity>;
      },
      beforeDelete: async (id) => {
        const party = await partyRepository.findById(id);
        if (!party) return;
        if (await hasTransactions(party.type, id)) {
          throw AppError.conflict(`Cannot delete ${party.type} with linked transactions`);
        }
      },
      afterCreate: async (entity, audit) => {
        await notificationService.create({
          kind: "success",
          title: entity.type === "customer" ? "New customer" : "New supplier",
          message: entity.name,
          resource: entity.type,
          resourceId: entity.id,
          actor: audit.principal,
        });
      },
    });
  }

  override async list(options: ListOptions): Promise<{ items: Party[]; total: number; page: number; limit: number; totalPages: number }> {
    const result = await partyRepository.list({
      ...options,
      searchFields: this.searchFields,
      filters: { ...(options.filters ?? {}), type: [this.partyType] },
    });
    return result as { items: Party[]; total: number; page: number; limit: number; totalPages: number };
  }

  override async create(input: PartyCreateInput, audit: AuditContext): Promise<Party> {
    const normalized = { ...input, type: this.partyType };
    const code = (normalized.code ?? (await makeCode(this.partyType))).toUpperCase();
    if (await partyRepository.findByCode(code, this.partyType)) {
      throw AppError.conflict(`${this.partyType} code "${code}" already exists`);
    }
    await this.assertUnique(normalized);
    normalized.code = code;
    return super.create(normalized, audit);
  }

  override async update(id: string, input: PartyUpdateInput, audit: AuditContext): Promise<Party> {
    const existing = await partyRepository.findById(id);
    if (!existing) throw AppError.notFound(`${this.partyType} not found`);
    await this.assertUnique(input, id);
    if (input.code) {
      const code = input.code.toUpperCase();
      const clash = await partyRepository.findByCode(code, this.partyType);
      if (clash && clash.id !== id) {
        throw AppError.conflict(`${this.partyType} code "${code}" already exists`);
      }
      input = { ...input, code };
    }
    return super.update(id, input, audit);
  }

  /** Phone, email and tax number must be unique across every party record. */
  private async assertUnique(
    input: PartyCreateInput | PartyUpdateInput,
    excludeId?: string,
  ): Promise<void> {
    if (input.email) {
      const clash = await partyRepository.findByEmail(input.email);
      if (clash && clash.id !== excludeId) {
        throw AppError.conflict(`Party with email "${input.email}" already exists`);
      }
    }
    if (input.phone) {
      const clash = await partyRepository.findByPhone(input.phone);
      if (clash && clash.id !== excludeId) {
        throw AppError.conflict(`Party with phone "${input.phone}" already exists`);
      }
    }
    if (input.taxNumber) {
      const clash = await partyRepository.findByTaxNumber(input.taxNumber);
      if (clash && clash.id !== excludeId) {
        throw AppError.conflict(`Party with tax number "${input.taxNumber}" already exists`);
      }
    }
  }
}

async function hasTransactions(type: PartyType, partyId: string): Promise<boolean> {
  return (await invoiceRepository.findAll()).some(
    (inv) => (type === "customer" ? inv.customerId : inv.supplierId) === partyId,
  );
}

export function createPartyService(type: PartyType): PartyService {
  return new PartyService(type);
}
