const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')
const fetch = global.fetch || require('node-fetch')

const prisma = new PrismaClient()

const ADMIN = String(process.env.ADMIN_MOBILE || '').replace(/\D/g, '').trim()
if (!ADMIN) {
  console.error('ADMIN_MOBILE not set in .env.local')
  process.exit(1)
}

function createOtpCode() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

async function main() {
  // find existing user or create/update as admin
  let user = await prisma.appUser.findFirst({ where: { mobile: ADMIN } })
  if (!user) {
    user = await prisma.appUser.create({
      data: {
        name: 'Admin',
        mobile: ADMIN,
        phoneNumber: ADMIN,
        role: 'admin',
        approvalStatus: 'approved',
        approvedAt: new Date(),
        deviceApprovalStatus: 'none',
      },
    })
  } else if (user.role !== 'admin' || user.approvalStatus !== 'approved') {
    user = await prisma.appUser.update({
      where: { id: user.id },
      data: { role: 'admin', approvalStatus: 'approved', approvedAt: new Date() },
    })
  }

  const otp = createOtpCode()
  const otpHash = await hash(otp, 10)
  const expiresAt = new Date(Date.now() + (Number(process.env.WHATSAPP_OTP_TTL_MINUTES || 5) * 60 * 1000))

  // delete existing unconsumed OTPs for this user/purpose
  await prisma.whatsappOtp.deleteMany({ where: { employeeId: user.id, mobile: ADMIN, purpose: 'login', consumedAt: null } })

  const created = await prisma.whatsappOtp.create({
    data: {
      employeeId: user.id,
      mobile: ADMIN,
      otpHash,
      purpose: 'login',
      expiresAt,
    },
  })

  console.log('Inserted OTP for admin user:', user.id)
  console.log('Plain OTP (use to verify):', otp)

  // submit to admin-login route
  const deviceId = `web-local-${Date.now()}`
  try {
    const res = await fetch('http://localhost:3000/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: ADMIN, deviceId, otp }),
    })
    const data = await res.json().catch(() => ({}))
    console.log('Login response status:', res.status)
    console.log(JSON.stringify(data, null, 2))
    const setCookie = res.headers.get ? res.headers.get('set-cookie') : null
    if (setCookie) console.log('Set-Cookie:', setCookie)
  } catch (err) {
    console.error('Login request failed', err)
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
