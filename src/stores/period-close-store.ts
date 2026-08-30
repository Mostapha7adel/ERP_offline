import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PeriodClose } from "@/types/domain";

interface PeriodCloseState {
  items: PeriodClose[];
  hydrate: (items: PeriodClose[]) => void;
  upsert: (item: PeriodClose) => void;
  reset: () => void;
}

export const usePeriodCloseStore = create<PeriodCloseState>()(
  persist(
    (set) => ({
      items: [],
      hydrate: (items) => set({ items }),
      upsert: (item) =>
        set((state) => {
          const exists = state.items.some((i) => i.id === item.id);
          return {
            items: exists
              ? state.items.map((i) => (i.id === item.id ? item : i))
              : [item, ...state.items],
          };
        }),
      reset: () => set({ items: [] }),
    }),
    { name: "ledgerflow:period-close" },
  ),
);
