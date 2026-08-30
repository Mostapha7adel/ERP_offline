import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BranchProfitItem } from "@/types/domain";

interface BranchProfitState {
  items: BranchProfitItem[];
  hydrate: (items: BranchProfitItem[]) => void;
  reset: () => void;
}

export const useBranchProfitStore = create<BranchProfitState>()(
  persist(
    (set) => ({
      items: [],
      hydrate: (items) => set({ items }),
      reset: () => set({ items: [] }),
    }),
    { name: "ledgerflow:branch-profit" },
  ),
);
