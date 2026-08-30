import { createEntityStore } from "./entity-store";
import type { Warranty } from "@/types/domain";

export const useWarrantiesStore = createEntityStore<Warranty>(
  "warranties",
  [],
);
