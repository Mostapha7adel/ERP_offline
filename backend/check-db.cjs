const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const t = await p.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("tables:", JSON.stringify(t.map((r) => r.name)));
  const c = await p.$queryRawUnsafe("SELECT COUNT(*) as n FROM User");
  console.log("users:", c[0].n);
  const m = await p.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='_Migrations'",
  );
  console.log("_Migrations exists:", m.length > 0);
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
