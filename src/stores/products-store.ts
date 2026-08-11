import { createEntityStore } from "./entity-store";
import type { Product } from "@/types/domain";

export const useProductsStore = createEntityStore<Product>("products", []);

export const useCategoriesStore = createEntityStore<{ id: string; name: string }>(
  "categories",
  [],
);
