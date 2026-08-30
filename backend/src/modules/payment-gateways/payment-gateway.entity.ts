export interface PaymentGatewayConfig {
  id: string;
  name: string;
  isActive: boolean;
  config?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayTransaction {
  id: string;
  gatewayConfigId: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  status: string;
  externalRef?: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}
