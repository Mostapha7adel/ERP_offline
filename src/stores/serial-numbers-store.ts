import { createEntityStore } from "./entity-store";
import type { SerialNumber } from "@/types/domain";

export const useSerialNumbersStore = createEntityStore<SerialNumber>(
  "serial-numbers",
  [],
);
