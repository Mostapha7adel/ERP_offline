import { createEntityStore } from "./entity-store";
import type { CurrencyRate } from "@/types/domain";

export const useCurrenciesStore = createEntityStore<CurrencyRate>(
  "currencies",
  [],
);

export function getCurrencySymbol(code: string, currencies: CurrencyRate[]): string {
  const found = currencies.find((c) => c.code === code);
  return found?.symbol || code;
}