import { createEntityStore } from "./entity-store";
import type { SalesReturn } from "@/types/domain";

export const useSalesReturnsStore = createEntityStore<SalesReturn>(
  "sales-returns",
  [],
);
