import { createEntityStore } from "./entity-store";
import type { TradeNote } from "@/types/domain";

export const useNotesStore = createEntityStore<TradeNote>("notes", []);
