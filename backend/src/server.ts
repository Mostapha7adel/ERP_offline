import "./bootstrap.js";
import { existsSync, copyFileSync } from "node:fs";
import { buildServer } from "./app.js";
import { env } from "./config/env.js";
import { seedDatabase } from "./seed/seed.js";
import { runMigrations } from "./core/database/migrations.js";
import { connectDb, disconnectDb } from "./core/database/prisma.js";
import { logger } from "./core/logger/logger.js";
import { networkService } from "./modules/network/network.service.js";

/** Resolve the local SQLite file path from DATABASE_URL (file:... or file:./...). */
function databaseFilePath(): string | null {
  const raw = process.env.DATABASE_URL;
  if (!raw?.startsWith("file:")) return null;
  let path = raw.slice("file:".length);
  // Prisma allows file:./relative.db
  if (path.startsWith("./")) path = path.slice(2);
  return path || null;
}

/** Make a rolling copy of a healthy database file for automatic recovery. */
function snapshotDatabaseFile(): void {
  const file = databaseFilePath();
  if (!file || !existsSync(file)) return;
  try {
    copyFileSync(file, `${file}.bak`);
  } catch (err) {
    logger.warn({ err }, "Could not snapshot database file");
  }
}

/** Try to recover a corrupt/missing database from the last snapshot. */
function tryRecoverDatabase(): boolean {
  const file = databaseFilePath();
  if (!file) return false;
  const backup = `${file}.bak`;
  if (!existsSync(backup)) return false;
  try {
    copyFileSync(backup, file);
    logger.info("Recovered database from last snapshot");
    return true;
  } catch (err) {
    logger.error({ err }, "Could not recover database from snapshot");
    return false;
  }
}

async function main(): Promise<void> {
  try {
    await connectDb();
    await runMigrations();
    await seedDatabase();
    // Database is healthy — keep a rolling snapshot for auto-recovery.
    snapshotDatabaseFile();
  } catch (err) {
    logger.error({ err }, "Database setup failed");
    // Attempt automatic recovery from a snapshot of the last healthy database.
    if (tryRecoverDatabase()) {
      try {
        await connectDb();
        await runMigrations();
        await seedDatabase();
        snapshotDatabaseFile();
      } catch (retryErr) {
        logger.error({ err: retryErr }, "Database recovery failed");
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  const app = await buildServer();

  // Rotate the LAN join code on every host boot: a code from a previous
  // session (or a code leaked before a disconnect) must not keep working.
  if (env.LAN_MODE === "host") {
    try {
      await networkService.rotateJoinCode();
      logger.info("Rotated LAN join code for host boot");
    } catch (err) {
      logger.warn({ err }, "Could not rotate LAN join code");
    }
  }

  try {
    // In "host" mode the super admin device must be reachable by other machines
    // on the LAN, so we bind every interface. Standalone/client keep the
    // configured host (loopback by default).
    const listenHost = env.LAN_MODE === "host" ? "0.0.0.0" : env.HOST;
    await app.listen({ port: env.PORT, host: listenHost });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main().catch((err) => {
  logger.error({ err }, "Startup failed");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  try {
    await disconnectDb();
  } catch {
    // ignore
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
