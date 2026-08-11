const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const m = await p.$queryRawUnsafe('SELECT name, appliedAt FROM "_Migrations" ORDER BY name');
  console.log("_Migrations:", JSON.stringify(m, null, 0));
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
