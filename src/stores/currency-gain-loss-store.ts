import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CurrencyGainLossItem } from "@/types/domain";

interface CurrencyGainLossState {
  items: CurrencyGainLossItem[];
  hydrate: (items: CurrencyGainLossItem[]) => void;
  reset: () => void;
}

export const useCurrencyGainLossStore = create<CurrencyGainLossState>()(
  persist(
    (set) => ({
      items: [],
      hydrate: (items) => set({ items }),
      reset: () => set({ items: [] }),
    }),
    { name: "ledgerflow:currency-gain-loss" },
  ),
);
