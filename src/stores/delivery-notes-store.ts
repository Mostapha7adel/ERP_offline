import { createEntityStore } from "./entity-store";
import type { DeliveryNote } from "@/types/domain";

export const useDeliveryNotesStore = createEntityStore<DeliveryNote>(
  "delivery-notes",
  [],
);
