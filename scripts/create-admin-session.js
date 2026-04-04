const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error('Usage: node scripts/create-admin-session.js <10-digit-mobile>')
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({ where: { mobile } })
  if (!user) {
    console.error(JSON.stringify({ success: false, reason: 'user_not_found', mobile }, null, 2))
    return
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)

  // create session
  await prisma.appSession.create({ data: { token, userId: user.id, expiresAt } })

  // ensure user is approved
  await prisma.appUser.update({ where: { id: user.id }, data: { approvalStatus: 'approved' } })

  const cookieValue = `autoflow_session=${token}; Path=/; Expires=${expiresAt.toUTCString()}; SameSite=Lax`;

  console.log(JSON.stringify({ success: true, mobile, cookie: cookieValue, token, expiresAt: expiresAt.toISOString() }, null, 2))
  console.log('\nTo set the cookie in your browser console, run:')
  console.log(`document.cookie = "${cookieValue}"`)
  console.log('\nThen reload the app at http://localhost:3000')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
