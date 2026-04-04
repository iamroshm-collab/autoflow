const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const mobile = process.argv[2]

if (!mobile) {
  console.error('Usage: node scripts/delete-related-records.js <10-digit-mobile>')
  process.exit(1)
}

async function main() {
  const backupsDir = path.resolve(__dirname, 'backups')
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupsDir, `${mobile}-full-backup-${timestamp}.json`)

  // Gather data to back up
  const user = await prisma.appUser.findFirst({ where: { mobile } })
  const sessions = user ? await prisma.appSession.findMany({ where: { userId: user.id } }) : []
  const whatsappOtps = user ? await prisma.whatsappOtp.findMany({ where: { mobile } }) : []

  const notificationsByBody = await prisma.appNotification.findMany({ where: { body: { contains: mobile } }, orderBy: { createdAt: 'desc' }, take: 200 })
  const notificationsByUser = user ? await prisma.appNotification.findMany({ where: { targetUserId: user.id }, orderBy: { createdAt: 'desc' }, take: 200 }) : []

  // Employees with this mobile
  const employees = await prisma.employee.findMany({ where: { OR: [{ mobile }, { whatsappId: { contains: mobile } }] } })
  const employeeIds = employees.map((e) => e.employeeId)

  // Notification devices and device tokens for employees
  const notificationDevices = employeeIds.length ? await prisma.notificationDevice.findMany({ where: { employeeId: { in: employeeIds } } }) : []
  let deviceTokens = []
  try {
    deviceTokens = employeeIds.length ? await prisma.deviceToken.findMany({ where: { employeeId: { in: employeeIds } } }) : []
  } catch (err) {
    // deviceToken model may be named differently; ignore if not present
    deviceTokens = []
  }

  const backup = { user, sessions, whatsappOtps, notificationsByBody, notificationsByUser, employees, notificationDevices, deviceTokens }
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8')

  // Delete records (safe-order)
  const results = {}

  if (user) {
    const delSessions = await prisma.appSession.deleteMany({ where: { userId: user.id } })
    results.deletedSessions = delSessions.count
  } else {
    results.deletedSessions = 0
  }

  // Delete whatsapp otps matching mobile
  const delOtps = await prisma.whatsappOtp.deleteMany({ where: { mobile } })
  results.deletedWhatsappOtps = delOtps.count

  // Delete notifications by targetUserId
  if (user) {
    const delByUser = await prisma.appNotification.deleteMany({ where: { targetUserId: user.id } })
    results.deletedNotificationsByUser = delByUser.count
  }

  // Delete notifications matching body
  const delByBody = await prisma.appNotification.deleteMany({ where: { body: { contains: mobile } } })
  results.deletedNotificationsByBody = delByBody.count

  // Delete notification devices and device tokens
  if (employeeIds.length) {
    const delNotifDevices = await prisma.notificationDevice.deleteMany({ where: { employeeId: { in: employeeIds } } })
    results.deletedNotificationDevices = delNotifDevices.count
    try {
      const delDeviceTokens = await prisma.deviceToken.deleteMany({ where: { employeeId: { in: employeeIds } } })
      results.deletedDeviceTokens = delDeviceTokens.count
    } catch (err) {
      results.deletedDeviceTokens = 0
    }

    const delEmployees = await prisma.employee.deleteMany({ where: { employeeId: { in: employeeIds } } })
    results.deletedEmployees = delEmployees.count
  } else {
    results.deletedNotificationDevices = 0
    results.deletedDeviceTokens = 0
    results.deletedEmployees = 0
  }

  // Finally delete the appUser row
  if (user) {
    const delUser = await prisma.appUser.deleteMany({ where: { id: user.id } })
    results.deletedAppUser = delUser.count
  } else {
    results.deletedAppUser = 0
  }

  console.log(JSON.stringify({ success: true, backup: backupPath, results }, null, 2))
}

main()
  .catch((err) => {
    console.error('ERROR', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
