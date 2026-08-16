import { createEntityStore } from "./entity-store";
import type { CustomerAdvance } from "@/types/domain";

export const useAdvancesStore = createEntityStore<CustomerAdvance>(
  "advances",
  [],
);