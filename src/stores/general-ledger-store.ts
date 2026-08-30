import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GeneralLedgerReport } from "@/types/domain";

interface GeneralLedgerState {
  report: GeneralLedgerReport | null;
  hydrate: (report: GeneralLedgerReport) => void;
  reset: () => void;
}

export const useGeneralLedgerStore = create<GeneralLedgerState>()(
  persist(
    (set) => ({
      report: null,
      hydrate: (report) => set({ report }),
      reset: () => set({ report: null }),
    }),
    { name: "ledgerflow:general-ledger" },
  ),
);
