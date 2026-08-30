import { createEntityStore } from "./entity-store";
import type { PaymentVoucher } from "@/types/domain";

export const usePaymentVouchersStore = createEntityStore<PaymentVoucher>(
  "payment-vouchers",
  [],
);
