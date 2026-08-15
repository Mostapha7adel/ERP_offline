import { createEntityStore } from "./entity-store";
import type { Quote } from "@/types/domain";

export const useQuotesStore = createEntityStore<Quote>("quotes", []);

export function computeQuoteTotals(
  lines: Quote["lines"],
  discount: number,
) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const discountAmount = round2((subtotal * discount) / 100);
  const total = round2(subtotal - discountAmount);
  return { subtotal, discountAmount, tax: 0, total };
}
