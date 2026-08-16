import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { CustomerAdvance, AdvanceAllocation } from "./advance.entity.js";

type Row = Record<string, unknown>;

/** Map user-facing payment methods to Prisma enum values (mirrors invoice repo). */
const PAY_TO_DB: Record<string, string> = {
  cash: "cash",
  bank: "bankTransfer",
  bankTransfer: "bankTransfer",
  card: "card",
  check: "check",
  credit: "credit",
  other: "other",
};

const PAY_FROM_DB: Record<string, string> = {
  cash: "cash",
  bankTransfer: "bank",
  card: "card",
  check: "check",
  credit: "credit",
  other: "other",
};

export class CustomerAdvanceRepository extends PrismaRepository<CustomerAdvance> {
  protected model = "customerAdvance";
  protected dateFields = ["date"];
  protected searchFields = ["reference", "notes"];

  protected toEntity(row: Row): CustomerAdvance {
    return {
      id: String(row.id),
      partyId: String(row.partyId),
      amount: Number(row.amount),
      balance: Number(row.balance),
      currency: String(row.currency ?? "EGP"),
      date: this.toISO(row.date)!,
      method: row.method ? PAY_FROM_DB[String(row.method)] ?? String(row.method) : undefined,
      reference: row.reference ? String(row.reference) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  protected toCreateData(data: Omit<CustomerAdvance, keyof { id: string; createdAt: string; updatedAt: string }>): Record<string, unknown> {
    const { method, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(method ? { method: PAY_TO_DB[method] ?? "other" } : {}),
    };
  }

  protected toUpdateData(data: Partial<Omit<CustomerAdvance, keyof { id: string; createdAt: string; updatedAt: string }>>): Record<string, unknown> {
    const { method, ...rest } = data;
    return {
      ...this.convertDates(rest),
      ...(method !== undefined ? { method: method ? PAY_TO_DB[method] ?? "other" : null } : {}),
    };
  }

  async byParty(partyId: string): Promise<CustomerAdvance[]> {
    const all = await this.findAll();
    return all.filter((a) => a.partyId === partyId);
  }
}

export class AdvanceAllocationRepository extends PrismaRepository<AdvanceAllocation> {
  protected model = "advanceAllocation";
  protected dateFields = ["appliedAt"];

  protected toEntity(row: Row): AdvanceAllocation {
    return {
      id: String(row.id),
      advanceId: String(row.advanceId),
      invoiceId: String(row.invoiceId),
      amount: Number(row.amount),
      appliedAt: this.toISO(row.appliedAt)!,
      createdBy: String(row.createdBy),
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async byAdvance(advanceId: string): Promise<AdvanceAllocation[]> {
    const all = await this.findAll();
    return all.filter((a) => a.advanceId === advanceId);
  }

  async byInvoice(invoiceId: string): Promise<AdvanceAllocation[]> {
    const all = await this.findAll();
    return all.filter((a) => a.invoiceId === invoiceId);
  }
}

export const customerAdvanceRepository = new CustomerAdvanceRepository();
export const advanceAllocationRepository = new AdvanceAllocationRepository();