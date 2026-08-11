import { createEntityStore } from "./entity-store";
import type { Account, JournalEntry } from "@/types/domain";

export const useAccountsStore = createEntityStore<Account>("accounts", []);

export const useJournalStore = createEntityStore<JournalEntry>("journal", []);

export function accountBalance(accounts: Account[], accountId: string): number {
  return accounts.find((a) => a.id === accountId)?.balance ?? 0;
}
