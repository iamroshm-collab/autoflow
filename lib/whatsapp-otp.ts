import { randomInt } from "crypto"
import { compare, hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizeMobileNumber } from "@/lib/mobile-validation"
import { sendMetaWhatsappOtp } from "@/lib/meta-whatsapp"

const prismaClient = prisma as any

type OtpFallbackRecord = {
  employeeId: string
  mobile: string
  purpose: string
  otpHash: string
  expiresAt: Date
  consumedAt: Date | null
  createdAt: Date
}

declare global {
  // eslint-disable-next-line no-var
  var __whatsappOtpFallbackStore: Map<string, OtpFallbackRecord> | undefined
}

const getFallbackStore = () => {
  if (!globalThis.__whatsappOtpFallbackStore) {
    globalThis.__whatsappOtpFallbackStore = new Map<string, OtpFallbackRecord>()
  }

  return globalThis.__whatsappOtpFallbackStore
}

const getFallbackKey = (employeeId: string, mobile: string, purpose: string) => {
  return `${employeeId}:${mobile}:${purpose}`
}

const OTP_TTL_MINUTES = Number(process.env.WHATSAPP_OTP_TTL_MINUTES || "5")
const OTP_PURPOSES = new Set(["register", "login"])

const getRequiredEnv = (name: string) => String(process.env[name] || "").trim()

const createOtpCode = () => {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

// MSG91 sender replaced by Meta Cloud API — see lib/meta-whatsapp.ts

export const requestWhatsappOtp = async (params: {
  userId: string
  mobile: string
  purpose: "register" | "login"
}) => {
  const mobile = normalizeMobileNumber(params.mobile)
  const purpose = String(params.purpose || "").trim().toLowerCase()

  if (!mobile || mobile.length !== 10) {
    throw new Error("Mobile must be exactly 10 digits")
  }

  if (!OTP_PURPOSES.has(purpose)) {
    throw new Error("Unsupported OTP purpose")
  }

  const otp = createOtpCode()
  const otpHash = await hash(otp, 10)
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  if (prismaClient?.whatsappOtp?.deleteMany && prismaClient?.whatsappOtp?.create) {
    await prismaClient.whatsappOtp.deleteMany({
      where: {
        employeeId: params.userId,
        mobile,
        purpose,
        consumedAt: null,
      },
    })

    await prismaClient.whatsappOtp.create({
      data: {
        employeeId: params.userId,
        mobile,
        otpHash,
        purpose,
        expiresAt,
      },
    })
  } else {
    const store = getFallbackStore()
    store.set(getFallbackKey(params.userId, mobile, purpose), {
      employeeId: params.userId,
      mobile,
      purpose,
      otpHash,
      expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    })
  }

  await sendMetaWhatsappOtp(mobile, otp)

  return {
    expiresAt,
    otp: process.env.NODE_ENV === "production" ? undefined : otp,
  }
}

export const verifyWhatsappOtp = async (params: {
  userId: string
  mobile: string
  purpose: "register" | "login"
  otp: string
}) => {
  const mobile = normalizeMobileNumber(params.mobile)
  const purpose = String(params.purpose || "").trim().toLowerCase()
  const otp = String(params.otp || "").trim()

  if (!mobile || mobile.length !== 10) {
    throw new Error("Mobile must be exactly 10 digits")
  }

  if (!OTP_PURPOSES.has(purpose)) {
    throw new Error("Unsupported OTP purpose")
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new Error("OTP must be 6 digits")
  }

  let record: OtpFallbackRecord | null = null

  if (prismaClient?.whatsappOtp?.findFirst && prismaClient?.whatsappOtp?.update) {
    record = await prismaClient.whatsappOtp.findFirst({
      where: {
        employeeId: params.userId,
        mobile,
        purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    })
  } else {
    const store = getFallbackStore()
    record = store.get(getFallbackKey(params.userId, mobile, purpose)) || null
    if (record?.consumedAt) {
      record = null
    }
  }

  if (!record) {
    throw new Error("OTP not found. Request a new OTP.")
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new Error("OTP has expired. Request a new OTP.")
  }

  const valid = await compare(otp, record.otpHash)
  if (!valid) {
    throw new Error("Invalid OTP")
  }

  if (prismaClient?.whatsappOtp?.update && (record as any)?.id) {
    await prismaClient.whatsappOtp.update({
      where: { id: (record as any).id },
      data: { consumedAt: new Date() },
    })
  } else {
    const store = getFallbackStore()
    const key = getFallbackKey(params.userId, mobile, purpose)
    const current = store.get(key)
    if (current) {
      current.consumedAt = new Date()
      store.set(key, current)
    }
  }
}
