const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const m = await p.$queryRawUnsafe('SELECT name, appliedAt FROM "_Migrations" ORDER BY name');
  console.log("_Migrations rows:", JSON.stringify(m));
  const pm = await p.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name');
  console.log("_prisma_migrations rows:", JSON.stringify(pm));
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
