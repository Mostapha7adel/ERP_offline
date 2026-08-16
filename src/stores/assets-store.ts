import { createEntityStore } from "./entity-store";
import type { Asset } from "@/types/domain";

export const useAssetsStore = createEntityStore<Asset>("assets", []);