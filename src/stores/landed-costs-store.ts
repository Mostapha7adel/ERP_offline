import { createEntityStore } from "./entity-store";
import type { LandedCost } from "@/types/domain";

export const useLandedCostsStore = createEntityStore<LandedCost>(
  "landed-costs",
  [],
);
