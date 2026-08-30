import { PrismaRepository } from "../../core/repository/base-repository.js";
import type { PaymentGatewayConfig, PaymentGatewayTransaction } from "./payment-gateway.entity.js";

type Row = Record<string, unknown>;

export class PaymentGatewayConfigRepository extends PrismaRepository<PaymentGatewayConfig> {
  protected model = "paymentGatewayConfig";
  protected searchFields = ["name"];

  protected toEntity(row: Row): PaymentGatewayConfig {
    return {
      id: String(row.id),
      name: String(row.name),
      isActive: Boolean(row.isActive),
      config: row.config ? String(row.config) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }
}

export class PaymentGatewayTransactionRepository extends PrismaRepository<PaymentGatewayTransaction> {
  protected model = "paymentGatewayTransaction";
  protected searchFields = ["externalRef"];

  protected toEntity(row: Row): PaymentGatewayTransaction {
    return {
      id: String(row.id),
      gatewayConfigId: String(row.gatewayConfigId),
      invoiceId: row.invoiceId ? String(row.invoiceId) : undefined,
      amount: Number(row.amount),
      currency: String(row.currency),
      status: String(row.status),
      externalRef: row.externalRef ? String(row.externalRef) : undefined,
      metadata: row.metadata ? String(row.metadata) : undefined,
      createdAt: this.toISO(row.createdAt)!,
      updatedAt: this.toISO(row.updatedAt)!,
    };
  }

  async findByGateway(gatewayConfigId: string): Promise<PaymentGatewayTransaction[]> {
    const all = await this.findAll();
    return all.filter((t) => t.gatewayConfigId === gatewayConfigId);
  }

  async findByInvoice(invoiceId: string): Promise<PaymentGatewayTransaction[]> {
    const all = await this.findAll();
    return all.filter((t) => t.invoiceId === invoiceId);
  }

  async findByExternalRef(externalRef: string): Promise<PaymentGatewayTransaction | undefined> {
    const all = await this.findAll();
    return all.find((t) => t.externalRef === externalRef);
  }
}

export const paymentGatewayConfigRepository = new PaymentGatewayConfigRepository();
export const paymentGatewayTransactionRepository = new PaymentGatewayTransactionRepository();
