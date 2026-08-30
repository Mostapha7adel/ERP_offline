import { createEntityStore } from "./entity-store";
import type { ProfitReportItem } from "@/types/domain";

export const useProfitReportStore = createEntityStore<ProfitReportItem>(
  "profit-report",
  [],
);
