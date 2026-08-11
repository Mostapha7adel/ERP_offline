import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
/**
 * Runtime bootstrap. Must be imported FIRST in the entry point.
 *
 *  - A stable, random JWT signing secret replaces any placeholder (or missing)
 *    `JWT_SECRET` so a default secret never ships in any environment. The value
 *    is persisted in the user data directory so tokens survive restarts.
 *  - When the backend runs packaged inside a pkg/Tauri sidecar executable:
 *      * `process.cwd()` points at an unwritable location, and `file:./...`
 *        relative paths resolve inside the read-only snapshot. We redirect the
 *        SQLite database into a per-user writable data directory.
 *      * The Prisma query engine native module is extracted from the pkg
 *        snapshot into the data directory and pointed at via
 *        `PRISMA_QUERY_ENGINE_LIBRARY` so `@prisma/client` can load it without
 *        a local `node_modules` on disk.
 */

const PKG = Boolean((process as { pkg?: unknown }).pkg);
const PLACEHOLDER_SECRET = "change-me-to-a-long-random-secret";

/** Resolve the user data directory (writable) for a packaged install. */
function resolveDataDir(): string {
  const explicit = process.env.LEDGERFLOW_DATA_DIR;
  if (explicit && isAbsolute(explicit)) return explicit;
  if (explicit) return join(process.cwd(), explicit);

  const appData =
    process.env.APPDATA ??
    (process.platform === "win32"
      ? join(homedir(), "AppData", "Roaming")
      : join(homedir(), ".config"));

  return join(appData, "LedgerFlow");
}

function prismaEngineFileName(): string {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "win32") return "query_engine-windows.dll.node";
  if (platform === "darwin") {
    return arch === "arm64"
      ? "libquery_engine-darwin-arm64.dylib.node"
      : "libquery_engine-darwin-x64.dylib.node";
  }
  // Linux (not currently packaged, but harmless to define).
  return arch === "arm64"
    ? "libquery_engine-linux-arm64-openssl-3.0.x.so.node"
    : "libquery_engine-linux-x64-openssl-3.0.x.so.node";
}

function ensurePrismaEngine(dataDir: string): void {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;

  const engineFile = prismaEngineFileName();
  const target = join(dataDir, engineFile);

  // Candidate locations of the engine inside the pkg snapshot. The bundled
  // server.cjs lives at <snapshot>/dist/server.cjs, so the node_modules dir is
  // one level above `dist`. require.main.filename points at that entry.
  const bundleDir = (() => {
    try {
      const main = require.main?.filename;
      if (main) return dirname(main);
    } catch {
      // ESM: require unavailable
    }
    return undefined;
  })();
  const pkgRoot = bundleDir ? dirname(bundleDir) : process.cwd();
  const candidates = [
    join(pkgRoot, "node_modules", ".prisma", "client", engineFile),
    join(pkgRoot, "node_modules", "@prisma", "engines", engineFile),
    join(process.cwd(), "node_modules", ".prisma", "client", engineFile),
  ];

  let source: string | undefined;
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        source = candidate;
        break;
      }
    } catch {
      // ignore
    }
  }
  if (!source) return;

  try {
    const bytes = readFileSync(source);
    if (!existsSync(target) || readFileSync(target).length !== bytes.length) {
      writeFileSync(target, bytes);
    }
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = target;
  } catch {
    // Fall back to Prisma's default resolution; it may still find the module
    // when a real node_modules exists on disk (dev mode).
  }
}

/**
 * Ensures a strong, stable JWT secret in every environment. If a real secret
 * was provided explicitly it is left untouched; otherwise a random one is
 * generated and persisted to the data directory.
 */
function ensureJwtSecret(dataDir: string): void {
  const current = process.env.JWT_SECRET;
  if (current && current !== PLACEHOLDER_SECRET && current.length >= 32) return;

  const secretFile = join(dataDir, "jwt.secret");
  let secret: string | undefined;
  try {
    if (existsSync(secretFile)) {
      secret = readFileSync(secretFile, "utf8").trim();
    }
  } catch {
    // ignore read errors
  }
  if (!secret || secret.length < 32) {
    secret = randomBytes(48).toString("base64url");
    try {
      writeFileSync(secretFile, secret, { encoding: "utf8", mode: 0o600 });
    } catch {
      // if we cannot persist, still use the in-memory secret for this run
    }
  }
  process.env.JWT_SECRET = secret;
}

function bootstrap(): void {
  const dataDir = resolveDataDir();

  if (PKG) {
    try {
      mkdirSync(dataDir, { recursive: true });
    } catch {
      // If we cannot create the data dir, fall back to cwd and let the DB
      // connection surface the error in a clear way.
    }
  }

  // 0) Extract the Prisma query engine native module if it is not on disk
  //    (packaged builds only — dev has node_modules on disk).
  if (PKG) ensurePrismaEngine(dataDir);

  // 1) Redirect the SQLite database into the writable data directory
  //    (packaged builds only — dev keeps the project-local dev.db).
  if (PKG && (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:./"))) {
    const dbPath = join(dataDir, "ledgerflow.db");
    process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
  }

  // 2) Replace any placeholder/missing JWT secret (all environments).
  ensureJwtSecret(dataDir);
}

bootstrap();
