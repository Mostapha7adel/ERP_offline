import { createEntityStore } from "./entity-store";
import type { Budget } from "@/types/domain";

export const useBudgetsStore = createEntityStore<Budget>(
  "budgets",
  [],
);
