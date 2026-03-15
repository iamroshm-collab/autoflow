const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
    console.log(tables);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
