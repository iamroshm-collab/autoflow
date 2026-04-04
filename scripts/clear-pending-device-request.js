const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error('Usage: node scripts/clear-pending-device-request.js <10-digit-mobile>')
  process.exit(1)
}

async function main() {
  const user = await prisma.appUser.findFirst({ where: { mobile } })
  if (!user) {
    console.error(JSON.stringify({ success: false, reason: 'not_found', mobile }, null, 2))
    return
  }

  // backup current user row
  const backupsDir = path.resolve(__dirname, 'backups')
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupsDir, `${mobile}-appUser-backup-clearpending-${timestamp}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(user, null, 2), 'utf8')

  // clear pending device fields and reset deviceApprovalStatus
  const updated = await prisma.appUser.update({
    where: { id: user.id },
    data: {
      pendingDeviceId: null,
      pendingDeviceIp: null,
      deviceApprovalStatus: 'none',
    },
  })

  // remove approval-related notifications that mention this user or link to /approvals
  const deleted = await prisma.appNotification.deleteMany({
    where: {
      OR: [
        { url: '/approvals' },
        { body: { contains: user.mobile } },
        { body: { contains: user.name || '' } },
      ],
    },
  })

  console.log(JSON.stringify({ success: true, backup: backupPath, before: user, after: updated, deletedNotifications: deleted.count }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
