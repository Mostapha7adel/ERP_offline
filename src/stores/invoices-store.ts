import { createEntityStore } from "./entity-store";
import type { Invoice } from "@/types/domain";

export const useInvoicesStore = createEntityStore<Invoice>("invoices", []);

export function computeInvoiceTotals(
  lines: Invoice["lines"],
  discount: number,
  taxRate: number,
) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const discountAmount = round2((subtotal * discount) / 100);
  const tax = round2((subtotal - discountAmount) * (taxRate / 100));
  const total = round2(subtotal - discountAmount + tax);
  return { subtotal, discountAmount, tax, total };
}
