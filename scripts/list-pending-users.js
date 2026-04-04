const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.appUser.findMany({
    where: {
      OR: [
        { approvalStatus: { not: 'approved' } },
        { deviceApprovalStatus: { not: 'approved' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      name: true,
      mobile: true,
      role: true,
      approvalStatus: true,
      deviceApprovalStatus: true,
      pendingDeviceId: true,
      approvedDeviceId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  console.log(JSON.stringify(users, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
