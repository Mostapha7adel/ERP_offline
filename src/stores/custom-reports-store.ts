import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomReport } from "@/types/domain";

interface CustomReportsState {
  items: CustomReport[];
  hydrate: (items: CustomReport[]) => void;
  add: (item: CustomReport) => void;
  update: (id: string, patch: Partial<CustomReport>) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useCustomReportsStore = create<CustomReportsState>()(
  persist(
    (set) => ({
      items: [],
      hydrate: (items) => set({ items }),
      add: (item) => set((state) => ({ items: [item, ...state.items] })),
      update: (id, patch) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      remove: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      reset: () => set({ items: [] }),
    }),
    { name: "ledgerflow:custom-reports" },
  ),
);
