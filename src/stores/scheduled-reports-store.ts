import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScheduledReport } from "@/types/domain";

interface ScheduledReportsState {
  items: ScheduledReport[];
  hydrate: (items: ScheduledReport[]) => void;
  add: (item: ScheduledReport) => void;
  update: (id: string, patch: Partial<ScheduledReport>) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useScheduledReportsStore = create<ScheduledReportsState>()(
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
    { name: "ledgerflow:scheduled-reports" },
  ),
);
