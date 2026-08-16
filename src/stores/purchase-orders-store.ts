import { createEntityStore } from "./entity-store";
import type { PurchaseOrder } from "@/types/domain";

export const usePurchaseOrdersStore = createEntityStore<PurchaseOrder>(
  "purchase-orders",
  [],
);