import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, type Prisma } from "@prisma/client";
import { logger } from "../logger/logger.js";

/**
 * Global Prisma client.
 *
 * Transactional reads/writes go through the AsyncLocalStorage context so that
 * any repository operation running inside `withTransaction` automatically
 * joins the active `Prisma.TransactionClient` — keeping service code unchanged.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
});

export type DbClient = PrismaClient | Prisma.TransactionClient;

const transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient | null>();

/** Resolve the client for the current execution context (tx-aware). */
export function getDb(): DbClient {
  return transactionStorage.getStore() ?? prisma;
}

/** True when the caller is already inside a Prisma interactive transaction. */
export function isInTransaction(): boolean {
  return transactionStorage.getStore() !== undefined;
}

/**
 * Run a unit of work inside a Prisma interactive transaction.
 * Nested calls reuse the enclosing transaction instead of nesting.
 */
export async function runInTransaction<T>(work: () => Promise<T>): Promise<T> {
  const existing = transactionStorage.getStore();
  if (existing) return work();
  return prisma.$transaction(async (tx) => {
    return transactionStorage.run(tx, () => work());
  });
}

/** Graceful shutdown helper for tests / process exit. */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

export async function connectDb(): Promise<void> {
  try {
    await prisma.$connect();
    // Tune SQLite for this app's workload: WAL journaling allows concurrent
    // readers while one writer is active, and a busy timeout prevents
    // "database is locked" errors during short contention windows.
    try {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
      await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
      await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
      await prisma.$queryRawUnsafe("PRAGMA cache_size = -64000;"); // 64 MB page cache
      await prisma.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
      await prisma.$queryRawUnsafe("PRAGMA mmap_size = 268435456;"); // 256 MB memory-mapped I/O
    } catch (pragmaError) {
      // Pragmas are best-effort; some hosted/embedded engines reject them.
      logger.warn({ pragmaError }, "Could not apply SQLite pragmas");
    }
    logger.info("SQLite database connected");
  } catch (error) {
    logger.error({ error }, "Failed to connect to SQLite database");
    throw error;
  }
}
