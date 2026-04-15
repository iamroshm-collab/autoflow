const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const mobile = "9539876442";
  const user = await prisma.appUser.findFirst({
    where: { mobile, role: "admin" },
    select: { id: true, mobile: true, role: true, approvedDeviceId: true }
  });
  if (!user) {
    console.log(JSON.stringify({ found: false }));
    return;
  }

  const devices = await prisma.adminTrustedDevice.findMany({
    where: { appUserId: user.id, isActive: true },
    orderBy: { lastUsedAt: "desc" },
    select: { deviceId: true, isActive: true, lastUsedAt: true }
  });

  console.log(JSON.stringify({
    found: true,
    user,
    devices
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
