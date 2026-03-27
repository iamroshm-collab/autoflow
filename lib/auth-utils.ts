import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { hashPassword } from "@/lib/auth-session"

const prismaClient = prisma as any

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000

export const normalizeEmail = (value: string) => String(value || "").trim().toLowerCase()

export const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))

export const createSecureToken = () => randomBytes(32).toString("hex")

export const getAppBaseUrl = (origin?: string) => {
  const configured = String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim()
  if (configured) {
    return configured.replace(/\/$/, "")
  }

  const fallbackOrigin = String(origin || "").trim()
  if (fallbackOrigin) {
    return fallbackOrigin.replace(/\/$/, "")
  }

  return "http://localhost:3000"
}

export const createEmailVerificationToken = async (userId: string) => {
  const token = createSecureToken()
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)

  await prismaClient.emailVerificationToken.deleteMany({
    where: { employeeId: userId },
  })

  await prismaClient.emailVerificationToken.create({
    data: {
      employeeId: userId,
      token,
      expiresAt,
    },
  })

  return { token, expiresAt }
}

export const createPasswordResetToken = async (userId: string) => {
  const token = createSecureToken()
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

  await prismaClient.passwordResetToken.deleteMany({
    where: { employeeId: userId },
  })

  await prismaClient.passwordResetToken.create({
    data: {
      employeeId: userId,
      token,
      expiresAt,
    },
  })

  return { token, expiresAt }
}

export const sendVerificationEmail = async (params: {
  name: string
  email: string
  token: string
  origin?: string
}) => {
  const verificationUrl = `${getAppBaseUrl(params.origin)}/verify-email?token=${encodeURIComponent(params.token)}`

  await sendEmail({
    to: params.email,
    subject: "Verify your AutoFlow account",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h1 style="margin:0 0 16px;font-size:24px;">Verify your email</h1>
        <p style="margin:0 0 16px;line-height:1.6;">Hi ${params.name},</p>
        <p style="margin:0 0 16px;line-height:1.6;">Confirm your email address to continue your AutoFlow registration. This link expires in 24 hours.</p>
        <p style="margin:24px 0;">
          <a href="${verificationUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Verify email</a>
        </p>
        <p style="margin:0;line-height:1.6;">If the button does not work, open this link:</p>
        <p style="margin:8px 0 0;word-break:break-all;">${verificationUrl}</p>
      </div>
    `,
    text: `Hi ${params.name}, verify your AutoFlow account here: ${verificationUrl}`,
  })
}

export const sendPasswordResetEmail = async (params: {
  name: string
  email: string
  token: string
  origin?: string
}) => {
  const searchParams = new URLSearchParams({
    token: params.token,
    email: params.email,
  })
  const resetUrl = `${getAppBaseUrl(params.origin)}/reset-password?${searchParams.toString()}`

  await sendEmail({
    to: params.email,
    subject: "Reset your AutoFlow password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h1 style="margin:0 0 16px;font-size:24px;">Reset your password</h1>
        <p style="margin:0 0 16px;line-height:1.6;">Hi ${params.name},</p>
        <p style="margin:0 0 16px;line-height:1.6;">Use the link below to choose a new password. This link expires in 15 minutes.</p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Reset password</a>
        </p>
        <p style="margin:0;line-height:1.6;">If you did not request this, you can ignore this email.</p>
        <p style="margin:8px 0 0;word-break:break-all;">${resetUrl}</p>
      </div>
    `,
    text: `Hi ${params.name}, reset your AutoFlow password here: ${resetUrl}`,
  })
}

export const sendApprovalStatusEmail = async (params: {
  name: string
  email: string
  status: "approved" | "rejected"
  origin?: string
}) => {
  const loginUrl = `${getAppBaseUrl(params.origin)}/login`
  const isApproved = params.status === "approved"
  const subject = isApproved
    ? "Your AutoFlow account has been approved"
    : "Your AutoFlow registration was not approved"
  const heading = isApproved ? "Registration approved" : "Registration update"
  const body = isApproved
    ? "Your account has been approved by admin. You can log in now."
    : "Your registration request was not approved. Please contact admin for help."

  await sendEmail({
    to: params.email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h1 style="margin:0 0 16px;font-size:24px;">${heading}</h1>
        <p style="margin:0 0 16px;line-height:1.6;">Hi ${params.name},</p>
        <p style="margin:0 0 16px;line-height:1.6;">${body}</p>
        ${isApproved ? `<p style="margin:24px 0;"><a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Log in</a></p>` : ""}
        <p style="margin:0;line-height:1.6;">${isApproved ? "If the button does not work, open this link:" : "You can still access AutoFlow at:"}</p>
        <p style="margin:8px 0 0;word-break:break-all;">${loginUrl}</p>
      </div>
    `,
    text: isApproved
      ? `Hi ${params.name}, your AutoFlow account has been approved. Log in here: ${loginUrl}`
      : `Hi ${params.name}, your AutoFlow registration was not approved. Please contact admin. ${loginUrl}`,
  })
}

export const verifyEmailToken = async (token: string) => {
  const record = await prismaClient.emailVerificationToken.findUnique({
    where: { token },
    include: { employee: true },
  })

  if (!record) {
    throw new Error("Verification link is invalid or has already been used.")
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await prismaClient.emailVerificationToken.deleteMany({
      where: { employeeId: record.employeeId },
    })
    throw new Error("Verification link has expired.")
  }

  await prismaClient.appUser.update({
    where: { id: record.employeeId },
    data: { emailVerificationStatus: "verified" },
  })

  await prismaClient.emailVerificationToken.deleteMany({
    where: { employeeId: record.employeeId },
  })

  return record.employee
}

export const resetPasswordWithToken = async (token: string, password: string) => {
  const record = await prismaClient.passwordResetToken.findUnique({
    where: { token },
    include: { employee: true },
  })

  if (!record) {
    throw new Error("Reset link is invalid or has already been used.")
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await prismaClient.passwordResetToken.deleteMany({
      where: { employeeId: record.employeeId },
    })
    throw new Error("Reset link has expired.")
  }

  const passwordHash = await hashPassword(password)

  await prismaClient.appUser.update({
    where: { id: record.employeeId },
    data: { passwordHash },
  })

  await prismaClient.passwordResetToken.deleteMany({
    where: { employeeId: record.employeeId },
  })

  await prismaClient.appSession.deleteMany({
    where: { userId: record.employeeId },
  })

  return record.employee
}

export const issueVerificationEmailForUser = async (user: { id: string; name: string; email: string }, origin?: string) => {
  const { token } = await createEmailVerificationToken(user.id)
  await sendVerificationEmail({
    name: user.name,
    email: user.email,
    token,
    origin,
  })
}

export const issuePasswordResetEmailForUser = async (user: { id: string; name: string; email: string }, origin?: string) => {
  const { token } = await createPasswordResetToken(user.id)
  await sendPasswordResetEmail({
    name: user.name,
    email: user.email,
    token,
    origin,
  })
}