import { createEntityStore } from "./entity-store";
import type { BankAccount, MoneyTransaction } from "@/types/domain";

export const useBankAccountsStore = createEntityStore<BankAccount>(
  "bank-accounts",
  [],
);

export const useTransactionsStore = createEntityStore<MoneyTransaction>(
  "transactions",
  [],
);
