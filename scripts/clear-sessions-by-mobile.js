const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error('Usage: node scripts/clear-sessions-by-mobile.js <10-digit-mobile>')
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({ where: { mobile }, select: { id: true, name: true, mobile: true } })
  if (!user) {
    console.error(JSON.stringify({ success: false, reason: 'user_not_found', mobile }, null, 2))
    return
  }

  const deleted = await prisma.appSession.deleteMany({ where: { userId: user.id } })

  console.log(JSON.stringify({ success: true, user, deletedCount: deleted.count }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
