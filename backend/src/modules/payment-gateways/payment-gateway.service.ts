import { AppError } from "../../core/errors/app-error.js";
import { paymentGatewayConfigRepository, paymentGatewayTransactionRepository } from "./payment-gateway.repository.js";
import { paymentGatewayConfigCreateSchema, paymentGatewayConfigUpdateSchema, type PaymentGatewayConfigCreateInput, type PaymentGatewayConfigUpdateInput, type PaymentGatewayTransactionCreateInput } from "./payment-gateway.schema.js";
import type { PaymentGatewayConfig, PaymentGatewayTransaction } from "./payment-gateway.entity.js";
import type { AuditContext } from "../../core/audit/audit.service.js";
import { auditService } from "../../core/audit/audit.service.js";

export class PaymentGatewayService {
  async createConfig(input: PaymentGatewayConfigCreateInput, audit: AuditContext): Promise<PaymentGatewayConfig> {
    const validated = paymentGatewayConfigCreateSchema.parse(input);

    const existing = await paymentGatewayConfigRepository.findOne(
      (c) => c.name === validated.name,
    );
    if (existing) throw AppError.conflict(`Gateway "${validated.name}" already exists`);

    const config = await paymentGatewayConfigRepository.create({
      data: {
        name: validated.name,
        isActive: validated.isActive ?? true,
        config: validated.config,
      } as any,
    });

    void auditService.log(audit, "create:payment-gateway-config", "payment-gateway-config", config.id, {
      name: validated.name,
    });

    return config;
  }

  async updateConfig(id: string, input: PaymentGatewayConfigUpdateInput, audit: AuditContext): Promise<PaymentGatewayConfig> {
    const existing = await paymentGatewayConfigRepository.findById(id);
    if (!existing) throw AppError.notFound("Payment gateway config not found");

    const validated = paymentGatewayConfigUpdateSchema.parse(input);

    const updated = await paymentGatewayConfigRepository.update({
      id,
      data: {
        name: validated.name,
        isActive: validated.isActive,
        config: validated.config,
      },
    });

    void auditService.log(audit, "update:payment-gateway-config", "payment-gateway-config", id);
    return updated as PaymentGatewayConfig;
  }

  async deleteConfig(id: string, audit: AuditContext): Promise<{ id: string }> {
    const existing = await paymentGatewayConfigRepository.findById(id);
    if (!existing) throw AppError.notFound("Payment gateway config not found");
    await paymentGatewayConfigRepository.delete(id);
    void auditService.log(audit, "delete:payment-gateway-config", "payment-gateway-config", id);
    return { id };
  }

  async getConfigById(id: string): Promise<PaymentGatewayConfig> {
    const config = await paymentGatewayConfigRepository.findById(id);
    if (!config) throw AppError.notFound("Payment gateway config not found");
    return config;
  }

  async listConfigs(options: { page?: number; limit?: number; search?: string } = {}) {
    return paymentGatewayConfigRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["name"],
    });
  }

  async createTransaction(input: PaymentGatewayTransactionCreateInput, audit: AuditContext): Promise<PaymentGatewayTransaction> {
    const gatewayConfig = await paymentGatewayConfigRepository.findById(input.gatewayConfigId);
    if (!gatewayConfig) throw AppError.badRequest("Gateway config not found");
    if (!gatewayConfig.isActive) throw AppError.badRequest("Gateway is not active");

    const transaction = await paymentGatewayTransactionRepository.create({
      data: {
        gatewayConfigId: input.gatewayConfigId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        currency: input.currency ?? "EGP",
        status: "PENDING",
        externalRef: input.externalRef,
        metadata: input.metadata,
      } as any,
    });

    void auditService.log(audit, "create:payment-gateway-transaction", "payment-gateway-transaction", transaction.id, {
      gateway: gatewayConfig.name,
      amount: input.amount,
    });

    return transaction;
  }

  async getTransactionById(id: string): Promise<PaymentGatewayTransaction> {
    const transaction = await paymentGatewayTransactionRepository.findById(id);
    if (!transaction) throw AppError.notFound("Payment gateway transaction not found");
    return transaction;
  }

  async listTransactions(options: { page?: number; limit?: number; search?: string; filters?: Record<string, string[]> } = {}) {
    return paymentGatewayTransactionRepository.list({
      page: options.page,
      limit: options.limit,
      search: options.search,
      searchFields: ["externalRef"],
      filters: options.filters,
    });
  }
}

export const paymentGatewayService = new PaymentGatewayService();
