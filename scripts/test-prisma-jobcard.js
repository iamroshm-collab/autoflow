const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const id = process.argv[2] || 'cmm4v2l1v0004odl083vr90nx';
    console.log('Querying jobCard id=', id);
    const result = await prisma.jobCard.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        sparePartsBills: { orderBy: { sl: 'asc' } },
        serviceDescriptions: { orderBy: { sl: 'asc' } },
        employeeEarnings: { orderBy: { sl: 'asc' } },
      },
    });
    console.log('OK:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('ERROR:', e);
    if (e instanceof Error) console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
