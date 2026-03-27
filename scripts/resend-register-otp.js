const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })

const { PrismaClient } = require("@prisma/client")
const { hash } = require("bcryptjs")

const prisma = new PrismaClient()
const mobile = String(process.argv[2] || "").replace(/\D/g, "")

if (!/^\d{10}$/.test(mobile)) {
  console.error("Usage: node scripts/resend-register-otp.js <10-digit-mobile>")
  process.exit(1)
}

const token = String(process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim()
const phoneNumberId = String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim()
const apiVersion = String(process.env.META_WHATSAPP_API_VERSION || "v20.0").trim()
const templateName = String(process.env.META_WHATSAPP_OTP_TEMPLATE_NAME || "").trim()
const ttlMinutes = Number(process.env.WHATSAPP_OTP_TTL_MINUTES || "5")

if (!token || !phoneNumberId || !templateName) {
  console.error("Missing Meta env vars in .env.local")
  process.exit(1)
}

const buildPayload = (otp, includeButtonParam) => ({
  messaging_product: "whatsapp",
  to: `91${mobile}`,
  type: "template",
  template: {
    name: templateName,
    language: { code: "en_US" },
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: otp }],
      },
      ...(includeButtonParam
        ? [
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: otp }],
            },
          ]
        : []),
    ],
  },
})

async function sendOtpTemplate(otp) {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`

  const send = async (includeButtonParam) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildPayload(otp, includeButtonParam)),
    })
    return { res, body: await res.json() }
  }

  let { res, body } = await send(false)
  if (res.ok) return body

  const details = body?.error?.error_data?.details || ""
  if (details.includes("Button at index 0 of type Url requires a parameter")) {
    ;({ res, body } = await send(true))
    if (res.ok) return body
  }

  throw new Error(JSON.stringify(body))
}

async function main() {
  const user = await prisma.appUser.findFirst({ where: { mobile }, select: { id: true, approvalStatus: true } })

  if (!user) {
    console.error("No user found for mobile", mobile)
    process.exit(1)
  }

  if (user.approvalStatus !== "pending") {
    console.error(`User is ${user.approvalStatus}; resend-register-otp is intended for pending users.`)
    process.exit(1)
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const otpHash = await hash(otp, 10)
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

  await prisma.whatsappOtp.deleteMany({
    where: {
      employeeId: user.id,
      mobile,
      purpose: "register",
      consumedAt: null,
    },
  })

  await prisma.whatsappOtp.create({
    data: {
      employeeId: user.id,
      mobile,
      otpHash,
      purpose: "register",
      expiresAt,
    },
  })

  const metaResp = await sendOtpTemplate(otp)

  console.log(JSON.stringify({
    success: true,
    mobile,
    expiresAt: expiresAt.toISOString(),
    messageId: metaResp?.messages?.[0]?.id,
    otp,
  }, null, 2))
}

main()
  .catch((e) => {
    console.error("RESEND_REGISTER_OTP_FAILED", e.message || e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
