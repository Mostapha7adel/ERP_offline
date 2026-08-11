import { runInTransaction } from "./prisma.js";

/**
 * Transaction manager.
 *
 * Wraps Prisma interactive transactions. Repository operations resolve the
 * active `Prisma.TransactionClient` from AsyncLocalStorage, so all mutations
 * performed inside the callback are atomic — if the callback throws, the whole
 * transaction is rolled back.
 */
export class TransactionManager {
  run<T>(work: () => Promise<T>): Promise<T> {
    return runInTransaction(work);
  }
}

export const transactionManager = new TransactionManager();

/** Convenience alias: run a unit of work atomically. */
export const withTransaction = transactionManager.run.bind(transactionManager);
