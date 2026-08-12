// Patches the Prisma generated client so pkg can bundle it.
// Prisma 6's generated entry uses `require('#main-entry-point')`, which relies
// on package.json `imports` maps. pkg's module resolver does not support
// `#`-prefixed specifiers, so we rewrite it to a plain relative require before
// packaging. `prisma generate` regenerates the file, so this runs on every
// build.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../node_modules/.prisma/client/default.js");

function patchMarkers(file) {
  return [
    { from: "require('#main-entry-point')", to: "require('./index.js')" },
  ];
}

if (!existsSync(target)) {
  console.warn(`[patch-prisma-client] ${target} not found; skipping.`);
  process.exit(0);
}

let out = readFileSync(target, "utf8");
let changed = false;
for (const { from, to } of patchMarkers(target)) {
  if (out.includes(from)) {
    out = out.split(from).join(to);
    changed = true;
  }
}

if (!changed) {
  console.log("[patch-prisma-client] already patched.");
  process.exit(0);
}

writeFileSync(target, out, "utf8");
console.log(`[patch-prisma-client] patched ${target}`);