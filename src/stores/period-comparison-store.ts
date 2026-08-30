import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PeriodComparisonReport } from "@/types/domain";

interface PeriodComparisonState {
  report: PeriodComparisonReport | null;
  hydrate: (report: PeriodComparisonReport) => void;
  reset: () => void;
}

export const usePeriodComparisonStore = create<PeriodComparisonState>()(
  persist(
    (set) => ({
      report: null,
      hydrate: (report) => set({ report }),
      reset: () => set({ report: null }),
    }),
    { name: "ledgerflow:period-comparison" },
  ),
);
