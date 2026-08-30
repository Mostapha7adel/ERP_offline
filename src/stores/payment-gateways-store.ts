import { createEntityStore } from "./entity-store";
import type { PaymentGatewayConfig } from "@/types/domain";

export const usePaymentGatewaysStore = createEntityStore<PaymentGatewayConfig>(
  "payment-gateways",
  [],
);
