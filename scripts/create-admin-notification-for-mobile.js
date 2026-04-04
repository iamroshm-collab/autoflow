const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error('Usage: node scripts/create-admin-notification-for-mobile.js <mobile>')
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({ where: { mobile } })
  if (!user) {
    console.error('No user found with mobile', mobile)
    return
  }

  const notif = await prisma.appNotification.create({
    data: {
      title: 'Registration Approval Required',
      body: `${user.name || 'Unknown'} (${mobile}) has requested registration`,
      targetRole: 'admin',
      url: '/approvals',
      type: 'approval_request',
    },
  })

  console.log('Created notification:', JSON.stringify(notif, null, 2))
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
