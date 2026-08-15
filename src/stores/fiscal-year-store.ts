import { createEntityStore } from "./entity-store";
import type { FiscalYear } from "@/types/domain";

export const useFiscalYearsStore = createEntityStore<FiscalYear>("fiscal-years", []);
