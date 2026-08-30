import { createEntityStore } from "./entity-store";
import type { PriceList } from "@/types/domain";

export const usePriceListsStore = createEntityStore<PriceList>(
  "price-lists",
  [],
);
