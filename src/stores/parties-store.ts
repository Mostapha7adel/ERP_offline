import { createEntityStore } from "./entity-store";
import type { Party } from "@/types/domain";

export const useCustomersStore = createEntityStore<Party>("customers", []);

export const useSuppliersStore = createEntityStore<Party>("suppliers", []);
