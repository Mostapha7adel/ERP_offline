import { createEntityStore } from "./entity-store";
import type { LoyaltyAccount } from "@/types/domain";

export const useLoyaltyStore = createEntityStore<LoyaltyAccount>(
  "loyalty",
  [],
);
