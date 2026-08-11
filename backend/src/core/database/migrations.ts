import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./prisma.js";
import { logger } from "../logger/logger.js";

/**
 * Current module directory. Works under both ESM (tsx) and CJS (esbuild/pkg).
 * In the esbuild CJS bundle `require.main.filename` points at the bundled
 * entry (e.g. <snapshot>/dist/server.cjs) so its directory is the module dir;
 * under tsx ESM `import.meta.url` resolves to the source file.
 */
function moduleDir(): string {
  try {
    const main = require.main?.filename;
    if (main) return dirname(main);
  } catch {
    // ESM: require is unavailable
  }
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return resolve(process.cwd());
  }
}

/**
 * Minimal SQL statement splitter for Prisma-generated migration files.
 *
 * Prisma migration SQL is a sequence of statements terminated by `;`.
 * SQLite (via Prisma raw queries) executes one statement per call, so we
 * split on statement boundaries while respecting string literals and comments.
 */
export function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      current += c;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        current += "*/";
        i += 2;
        continue;
      }
      current += c;
      i++;
      continue;
    }
    if (inSingle) {
      if (c === "'" && next === "'") {
        current += "''";
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      current += c;
      i++;
      continue;
    }
    if (inDouble) {
      if (c === '"') inDouble = false;
      current += c;
      i++;
      continue;
    }
    if (inBacktick) {
      if (c === "`") inBacktick = false;
      current += c;
      i++;
      continue;
    }
    if (c === "-" && next === "-") {
      inLineComment = true;
      current += "--";
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      current += "/*";
      i += 2;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      current += c;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      current += c;
      i++;
      continue;
    }
    if (c === "`") {
      inBacktick = true;
      current += c;
      i++;
      continue;
    }
    if (c === ";") {
      statements.push(current.trim());
      current = "";
      i++;
      continue;
    }
    current += c;
    i++;
  }
  if (current.trim()) statements.push(current.trim());

  return statements.map(stripLeadingComments).filter((s) => s.length > 0);
}

/** Remove leading SQL comments from a single statement. */
function stripLeadingComments(statement: string): string {
  let out = statement;
  for (;;) {
    const t = out.trimStart();
    if (t.startsWith("--")) {
      const nl = t.indexOf("\n");
      if (nl === -1) {
        out = "";
        break;
      }
      out = t.slice(nl + 1);
      continue;
    }
    if (t.startsWith("/*")) {
      const end = t.indexOf("*/");
      if (end === -1) {
        out = "";
        break;
      }
      out = t.slice(end + 2);
      continue;
    }
    out = t;
    break;
  }
  return out.trim();
}

/** Resolve the migrations directory regardless of runtime (node or pkg snapshot). */
function migrationsDir(): string {
  const base = moduleDir();
  const candidates = [
    resolve(process.cwd(), "prisma/migrations"),
    resolve(process.cwd(), "backend/prisma/migrations"),
    resolve(base, "../../../prisma/migrations"),
    resolve(base, "../prisma/migrations"),
    resolve(base, "prisma/migrations"),
  ];
  for (const candidate of candidates) {
    try {
      const entries = readdirSync(candidate);
      if (entries.some((e) => e !== "migration_lock.toml")) return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("Migrations directory not found");
}

interface AppliedMigration {
  name: string;
}

/** Apply pending migrations in order. Idempotent across restarts. */
export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_Migrations" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" TEXT NOT NULL)`,
  );

  const appliedRows = await prisma.$queryRawUnsafe<AppliedMigration[]>(
    `SELECT "name" FROM "_Migrations"`,
  );
  const applied = new Set(appliedRows.map((r) => r.name));

  const dir = migrationsDir();
  const folders = readdirSync(dir)
    .filter((f) => f !== "migration_lock.toml")
    .sort();

  // Baseline detection: the database already has the real schema (created by
  // `prisma migrate` or an older binary) but our _Migrations bookkeeping is
  // empty. This happens when upgrading an existing install. In that case mark
  // every folder as already applied so we never recreate existing tables.
  const isFreshBaseline =
    applied.size === 0 &&
    folders.length > 0 &&
    (await doesTableExist("Company"));

  const justApplied: string[] = [];
  const skipped: string[] = [];

  for (const folder of folders) {
    if (applied.has(folder) || isFreshBaseline) {
      if (!applied.has(folder)) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_Migrations" ("name", "appliedAt") VALUES (?, ?)`,
          folder,
          new Date().toISOString(),
        );
      }
      skipped.push(folder);
      continue;
    }
    const file = join(dir, folder, "migration.sql");
    const sql = readFileSync(file, "utf8");
    const statements = splitSql(sql);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_Migrations" ("name", "appliedAt") VALUES (?, ?)`,
      folder,
      new Date().toISOString(),
    );
    justApplied.push(folder);
    logger.info({ migration: folder, statements: statements.length }, "Migration applied");
  }

  return { applied: justApplied, skipped };
}

async function doesTableExist(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    table,
  );
  return rows.length > 0;
}
