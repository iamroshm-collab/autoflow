const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main() {
  // Find users with registration/device pending
  const users = await prisma.appUser.findMany({
    where: {
      OR: [
        { approvalStatus: { in: ['pending', 'otp_pending'] } },
        { deviceApprovalStatus: 'pending' },
      ],
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      approvalStatus: true,
      deviceApprovalStatus: true,
      requestedDeviceId: true,
      pendingDeviceId: true,
    },
  })

  if (!users.length) {
    console.log('No pending requests found.')
    await prisma.$disconnect()
    return
  }

  const ids = users.map((u) => u.id)
  const mobiles = users.map((u) => u.mobile).filter(Boolean)

  // Gather related records for backup
  const sessions = await prisma.appSession.findMany({ where: { userId: { in: ids } } })
  const whatsappOtps = await prisma.whatsappOtp.findMany({ where: { employeeId: { in: ids } } })
  const adminTrustedDevices = await prisma.adminTrustedDevice.findMany({ where: { appUserId: { in: ids } } })

  // Notifications referencing these users (by refId or targetUserId) or containing mobile
  const notifWhere = {
    OR: [
      { refId: { in: ids } },
      { targetUserId: { in: ids } },
      ...(mobiles.length ? mobiles.map((m) => ({ body: { contains: m } })) : []),
    ],
  }
  const notifications = await prisma.appNotification.findMany({ where: notifWhere })

  const backup = { meta: { createdAt: new Date().toISOString(), count: users.length }, users, sessions, whatsappOtps, adminTrustedDevices, notifications }

  const backupDir = path.resolve(__dirname, 'backups')
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `pending-requests-backup-${ts()}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2))
  console.log('Backup written to', backupPath)

  // Delete related records in transaction-safe order
  const result = await prisma.$transaction(async (tx) => {
    const delSessions = await tx.appSession.deleteMany({ where: { userId: { in: ids } } })
    const delWhatsapp = await tx.whatsappOtp.deleteMany({ where: { employeeId: { in: ids } } })
    const delTrusted = await tx.adminTrustedDevice.deleteMany({ where: { appUserId: { in: ids } } })
    const delNotifications = await tx.appNotification.deleteMany({ where: notifWhere })
    const delUsers = await tx.appUser.deleteMany({ where: { id: { in: ids } } })

    return { delSessions, delWhatsapp, delTrusted, delNotifications, delUsers }
  })

  console.log('Deletion results:', JSON.stringify(result, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
