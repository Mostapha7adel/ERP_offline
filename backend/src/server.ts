import "./bootstrap.js";
import { existsSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildServer } from "./app.js";
import { env } from "./config/env.js";
import { seedDatabase } from "./seed/seed.js";
import { runMigrations } from "./core/database/migrations.js";
import { connectDb, disconnectDb } from "./core/database/prisma.js";
import { dataDir } from "./bootstrap.js";
import { logger } from "./core/logger/logger.js";
import { setBoundPort } from "./core/runtime/bound-port.js";
import { networkService } from "./modules/network/network.service.js";
import { scheduleEvery } from "./core/scheduler/scheduler.js";
import { autoBackupService } from "./core/backup/auto-backup.service.js";

/** Persist the actual bound port so the Tauri shell can discover it. */
function persistBoundPort(port: number): void {
  setBoundPort(port);
  try {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(join(dataDir(), "backend-port"), String(port), "utf8");
  } catch (err) {
    logger.warn({ err }, "Could not persist backend port file");
  }
}

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

    // Start at the configured port and walk upward until we find a free one.
    // This keeps the app usable when another program already holds port 3000.
    const MAX_PORT_ATTEMPTS = 20;
    let boundPort: number | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
      const port = env.PORT + attempt;
      try {
        await app.listen({ port, host: listenHost });
        boundPort = port;
        break;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "EADDRINUSE") {
          logger.warn({ port }, `Port ${port} is busy, trying the next one`);
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    if (boundPort === undefined) {
      throw lastErr ?? new Error("No free port found in the fallback range");
    }

    persistBoundPort(boundPort);
    logger.info({ port: boundPort, host: listenHost }, `Backend listening on port ${boundPort}`);

    // Scheduled background work (auto-backup + alert push). Unref'd so the
    // process still exits cleanly on shutdown.
    scheduleEvery(60 * 1000, "auto-backup", () => autoBackupService.tick());
    scheduleEvery(15 * 60 * 1000, "alert-push", async () => {
      const { alertService } = await import("./modules/alerts/alert.service.js");
      await alertService.notify();
    });
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
