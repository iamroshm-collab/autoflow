const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error('Usage: node scripts/check-pending-requests.js <10-digit-mobile>')
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({
    where: { mobile },
    select: {
      id: true,
      name: true,
      mobile: true,
      role: true,
      approvalStatus: true,
      requestedDeviceId: true,
      requestedDeviceIp: true,
      pendingDeviceId: true,
      pendingDeviceIp: true,
      approvedDeviceId: true,
      approvedDeviceIp: true,
      deviceApprovalStatus: true,
    },
  })

  const results = { user: user || null, notifications: [] }

  if (user) {
    // find notifications mentioning this user's mobile or name, or targeting approvals URL
    const notifs = await prisma.appNotification.findMany({
      where: {
        OR: [
          { body: { contains: user.mobile } },
          { body: { contains: user.name || '' } },
          { url: '/approvals' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    results.notifications = notifs
  } else {
    const notifs = await prisma.appNotification.findMany({
      where: { body: { contains: mobile } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    results.notifications = notifs
  }

  console.log(JSON.stringify(results, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
