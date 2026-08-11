import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const p = new PrismaClient();
try {
  const rows = await p.setting.findMany({ where: { key: { contains: "dateFormat" } } });
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.error("ERR", e.message);
} finally {
  await p.$disconnect();
}