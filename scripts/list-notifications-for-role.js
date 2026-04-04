const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const role = process.argv[2] || 'admin'

async function main() {
  const notifs = await prisma.appNotification.findMany({
    where: { OR: [{ targetRole: role }, { targetRole: 'all' }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  console.log(JSON.stringify(notifs, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
