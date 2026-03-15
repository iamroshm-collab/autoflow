const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.purchase.findMany({ take: 5 });
    console.log('purchase rows:', rows.length);
    if (rows.length > 0) console.log(JSON.stringify(rows[0], null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
