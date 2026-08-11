import { PrismaRepository, type PrismaModelDelegate } from "../../core/repository/base-repository.js";
import { getDb } from "../../core/database/prisma.js";
import type { Party } from "./party.entity.js";

type Row = Record<string, unknown>;

export class PartyRepository extends PrismaRepository<Party> {
  protected model = "party";
  protected searchFields = ["name", "code", "email", "phone", "taxNumber", "city", "contactName"];

  protected get delegate(): PrismaModelDelegate {
    return getDb().party as unknown as PrismaModelDelegate;
  }

  protected toEntity(row: Row): Party {
    return {
      id: String(row.id),
      type: row.type as Party["type"],
      code: String(row.code),
      name: String(row.name),
      contactName: row.contactName ? String(row.contactName) : undefined,
      email: row.email ? String(row.email) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      address: row.address ? String(row.address) : undefined,
      city: row.city ? String(row.city) : undefined,
      taxNumber: row.taxNumber ? String(row.taxNumber) : undefined,
      creditLimit: row.creditLimit != null ? Number(row.creditLimit) : undefined,
      currency: String(row.currency),
      notes: row.notes ? String(row.notes) : undefined,
      status: row.status as Party["status"],
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByCode(code: string, type: Party["type"]): Promise<Party | undefined> {
    const parties = await this.findAll();
    return parties.find((p) => p.type === type && p.code.toLowerCase() === code.toLowerCase());
  }

  async findByEmail(email: string): Promise<Party | undefined> {
    const value = email.trim().toLowerCase();
    return (await this.findAll()).find((p) => p.email && p.email.toLowerCase() === value);
  }

  async findByPhone(phone: string): Promise<Party | undefined> {
    const value = phone.trim().toLowerCase();
    return (await this.findAll()).find((p) => p.phone && p.phone.toLowerCase() === value);
  }

  async findByTaxNumber(taxNumber: string): Promise<Party | undefined> {
    const value = taxNumber.trim().toLowerCase();
    return (await this.findAll()).find((p) => p.taxNumber && p.taxNumber.toLowerCase() === value);
  }
}

export const partyRepository = new PartyRepository();
