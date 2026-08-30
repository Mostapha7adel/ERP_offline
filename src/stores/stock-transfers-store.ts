import { createEntityStore } from "./entity-store";
import type { StockTransfer } from "@/types/domain";

export const useStockTransfersStore = createEntityStore<StockTransfer>(
  "stock-transfers",
  [],
);
