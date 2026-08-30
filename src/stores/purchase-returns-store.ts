import { createEntityStore } from "./entity-store";
import type { PurchaseReturn } from "@/types/domain";

export const usePurchaseReturnsStore = createEntityStore<PurchaseReturn>(
  "purchase-returns",
  [],
);
