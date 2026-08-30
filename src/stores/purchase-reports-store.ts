import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PurchaseBySupplier, PurchaseByCategory, PurchaseTrend } from "@/types/domain";

interface PurchaseReportsState {
  bySupplier: PurchaseBySupplier[];
  byCategory: PurchaseByCategory[];
  trend: PurchaseTrend[];
  hydrateBySupplier: (items: PurchaseBySupplier[]) => void;
  hydrateByCategory: (items: PurchaseByCategory[]) => void;
  hydrateTrend: (items: PurchaseTrend[]) => void;
  reset: () => void;
}

export const usePurchaseReportsStore = create<PurchaseReportsState>()(
  persist(
    (set) => ({
      bySupplier: [],
      byCategory: [],
      trend: [],
      hydrateBySupplier: (items) => set({ bySupplier: items }),
      hydrateByCategory: (items) => set({ byCategory: items }),
      hydrateTrend: (items) => set({ trend: items }),
      reset: () => set({ bySupplier: [], byCategory: [], trend: [] }),
    }),
    { name: "ledgerflow:purchase-reports" },
  ),
);
