import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
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
const transactionStorage = new AsyncLocalStorage();
/** Resolve the client for the current execution context (tx-aware). */
export function getDb() {
    return transactionStorage.getStore() ?? prisma;
}
/** True when the caller is already inside a Prisma interactive transaction. */
export function isInTransaction() {
    return transactionStorage.getStore() !== undefined;
}
/**
 * Run a unit of work inside a Prisma interactive transaction.
 * Nested calls reuse the enclosing transaction instead of nesting.
 */
export async function runInTransaction(work) {
    const existing = transactionStorage.getStore();
    if (existing)
        return work();
    return prisma.$transaction(async (tx) => {
        return transactionStorage.run(tx, () => work());
    });
}
/** Graceful shutdown helper for tests / process exit. */
export async function disconnectDb() {
    await prisma.$disconnect();
}
export async function connectDb() {
    try {
        await prisma.$connect();
        logger.info("SQLite database connected");
    }
    catch (error) {
        logger.error({ error }, "Failed to connect to SQLite database");
        throw error;
    }
}
