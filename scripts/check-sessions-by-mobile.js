const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error('Usage: node scripts/check-sessions-by-mobile.js <10-digit-mobile>')
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({ where: { mobile }, select: { id: true, name: true, mobile: true, role: true, approvalStatus: true, approvedDeviceId: true, approvedDeviceIp: true } })
  if (!user) {
    console.error(JSON.stringify({ success: false, reason: 'user_not_found', mobile }, null, 2))
    return
  }

  const sessions = await prisma.appSession.findMany({ where: { userId: user.id }, select: { token: true, expiresAt: true, createdAt: true } })

  console.log(JSON.stringify({ success: true, user, sessions }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
