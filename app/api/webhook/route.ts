import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<Record<string, unknown>>
        contacts?: Array<Record<string, unknown>>
        statuses?: Array<Record<string, unknown>>
        user_id?: unknown
      }
    }>
  }>
}

type ResolvedIdentity = {
  whatsappId: string
  phoneNumber: string | null
}

const prismaClient = prisma as any

const getRequestSourceIp = (request: NextRequest) => {
  const cfConnectingIp = getString(request.headers.get("cf-connecting-ip"))
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // When using Cloudflare Tunnel, x-forwarded-for is set by Cloudflare/edge and can be
  // trusted for request logging if your origin is not directly exposed to the public internet.
  const xForwardedFor = getString(request.headers.get("x-forwarded-for"))
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim()
  }

  const xRealIp = getString(request.headers.get("x-real-ip"))
  if (xRealIp) {
    return xRealIp
  }

  return "unknown"
}

const getString = (value: unknown) => {
  return typeof value === "string" ? value.trim() : ""
}

const looksLikePhoneNumber = (value: string) => {
  return /^\+?\d{8,15}$/.test(value)
}

const normalizePhoneCandidate = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "")

  if (digits.length === 10) {
    return digits
  }

  if (digits.length > 10) {
    return digits.slice(-10)
  }

  return null
}

const resolveMessageIdentifier = (message: Record<string, unknown>, value: Record<string, unknown>) => {
  const contacts = Array.isArray(value.contacts) ? value.contacts : []
  const firstContact = (contacts[0] as Record<string, unknown> | undefined) || {}

  const whatsappIdCandidates = [
    getString(message.user_id),
    getString(firstContact.user_id),
    getString(value.user_id),
    getString(message.from),
    getString(firstContact.wa_id),
  ].filter(Boolean)

  if (!whatsappIdCandidates.length) {
    return null
  }

  const phoneLookupCandidate = [
    getString(message.from),
    getString(firstContact.wa_id),
    ...whatsappIdCandidates,
  ].find((candidate) => looksLikePhoneNumber(candidate)) || ""

  return {
    whatsappId: whatsappIdCandidates[0],
    phoneNumber: phoneLookupCandidate ? normalizePhoneCandidate(phoneLookupCandidate) : null,
  } satisfies ResolvedIdentity
}

const syncEmployeeIdentity = async (employeeRefId: number | null | undefined, identity: ResolvedIdentity) => {
  if (!Number.isInteger(employeeRefId)) {
    return null
  }

  return prismaClient.employee.update({
    where: { employeeId: Number(employeeRefId) },
    data: {
      whatsappId: identity.whatsappId,
      ...(identity.phoneNumber ? { phoneNumber: identity.phoneNumber } : {}),
    },
    select: {
      employeeId: true,
      empName: true,
      phoneNumber: true,
      whatsappId: true,
    },
  })
}

const findUserByIdentity = async (identity: ResolvedIdentity) => {
  const byWhatsappId = await prismaClient.appUser.findFirst({
    where: { whatsappId: identity.whatsappId },
    select: {
      id: true,
      name: true,
      role: true,
      mobile: true,
      phoneNumber: true,
      whatsappId: true,
      employeeRefId: true,
    },
  })

  if (byWhatsappId) {
    return { user: byWhatsappId, matchedBy: "whatsappId" as const }
  }

  if (!identity.phoneNumber) {
    return { user: null, matchedBy: null }
  }

  const byPhoneNumber = await prismaClient.appUser.findFirst({
    where: {
      OR: [
        { phoneNumber: identity.phoneNumber },
        { mobile: identity.phoneNumber },
      ],
    },
    select: {
      id: true,
      name: true,
      role: true,
      mobile: true,
      phoneNumber: true,
      whatsappId: true,
      employeeRefId: true,
    },
  })

  if (byPhoneNumber) {
    return { user: byPhoneNumber, matchedBy: "phoneNumber" as const }
  }

  const employee = await prismaClient.employee.findFirst({
    where: {
      OR: [
        { whatsappId: identity.whatsappId },
        { phoneNumber: identity.phoneNumber },
        { mobile: identity.phoneNumber },
      ],
    },
    select: {
      employeeId: true,
      empName: true,
      phoneNumber: true,
      whatsappId: true,
      appUser: {
        select: {
          id: true,
          name: true,
          role: true,
          mobile: true,
          phoneNumber: true,
          whatsappId: true,
          employeeRefId: true,
        },
      },
    },
  })

  if (employee?.appUser) {
    return { user: employee.appUser, matchedBy: "employeeLink" as const }
  }

  return { user: null, matchedBy: null }
}

const upsertUserIdentity = async (identity: ResolvedIdentity) => {
  const found = await findUserByIdentity(identity)

  if (found.user) {
    const updatedUser = await prismaClient.appUser.update({
      where: { id: found.user.id },
      data: {
        whatsappId: identity.whatsappId,
        ...(identity.phoneNumber ? { phoneNumber: identity.phoneNumber } : {}),
      },
      select: {
        id: true,
        name: true,
        role: true,
        phoneNumber: true,
        whatsappId: true,
        employeeRefId: true,
      },
    })

    await syncEmployeeIdentity(updatedUser.employeeRefId, identity)

    return {
      action: found.matchedBy === "whatsappId" ? "matched-existing" : "migrated-whatsapp-id",
      user: updatedUser,
    }
  }

  const guestUser = await prismaClient.appUser.create({
    data: {
      name: `Guest ${identity.whatsappId}`,
      role: "guest",
      approvalStatus: "pending",
      phoneNumber: identity.phoneNumber,
      whatsappId: identity.whatsappId,
    },
    select: {
      id: true,
      name: true,
      role: true,
      phoneNumber: true,
      whatsappId: true,
      employeeRefId: true,
    },
  })

  return {
    action: "created-guest",
    user: guestUser,
  }
}

const extractMessageText = (message: Record<string, unknown>): string => {
  const textObj = message.text as Record<string, unknown> | undefined
  if (typeof textObj?.body === "string" && textObj.body.trim()) {
    return textObj.body.trim()
  }
  const type = getString(message.type)
  if (type && type !== "text") {
    return `[${type}]`
  }
  return getString(message.body) || getString(message.content) || "[message]"
}

const saveIncomingMessage = async (
  message: Record<string, unknown>,
  identity: ResolvedIdentity,
  senderName: string | null
) => {
  try {
    const waMessageId = getString(message.id) || null
    const content = extractMessageText(message)
    const messageType = getString(message.type) || "text"

    await prismaClient.$executeRawUnsafe(
      `INSERT INTO whatsapp_messages (id, "waMessageId", "whatsappId", "phoneNumber", "senderName", content, "messageType", status, "receivedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'received', NOW())
       ON CONFLICT ("waMessageId") DO NOTHING`,
      crypto.randomUUID(),
      waMessageId,
      identity.whatsappId,
      identity.phoneNumber,
      senderName,
      content,
      messageType
    )
  } catch {
    // Non-critical — don't fail the webhook if message logging fails
  }
}

const processWebhookPayload = async (body: MetaWebhookPayload) => {
  const entry = Array.isArray(body.entry) ? body.entry : []
  const results: Array<Record<string, unknown>> = []

  for (const entryItem of entry) {
    const changes = Array.isArray(entryItem?.changes) ? entryItem.changes : []

    for (const change of changes) {
      const value = (change?.value || {}) as Record<string, unknown>
      const messages = Array.isArray(value.messages) ? value.messages : []

      // Extract sender name from contacts array if available
      const contacts = Array.isArray(value.contacts) ? value.contacts : []
      const firstContact = (contacts[0] as Record<string, unknown> | undefined) || {}
      const contactProfile = (firstContact.profile as Record<string, unknown> | undefined) || {}
      const senderName = getString(contactProfile.name) || getString(firstContact.name) || null

      for (const rawMessage of messages) {
        const message = (rawMessage || {}) as Record<string, unknown>
        const identity = resolveMessageIdentifier(message, value)

        if (!identity) {
          results.push({
            action: "ignored",
            reason: "missing-identifier",
          })
          continue
        }

        const outcome = await upsertUserIdentity(identity)
        await saveIncomingMessage(message, identity, senderName || outcome.user.name || null)
        results.push({
          action: outcome.action,
          whatsappId: identity.whatsappId,
          phoneNumber: identity.phoneNumber,
          userId: outcome.user.id,
          role: outcome.user.role,
        })
      }
    }
  }

  return results
}

// GET - Meta webhook verification handshake.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")
  const verifyToken = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
  const sourceIp = getRequestSourceIp(request)

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[META_WHATSAPP_WEBHOOK] Verified successfully", { sourceIp })
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  if (mode === "subscribe" && token === verifyToken && !challenge) {
    console.warn("[META_WHATSAPP_WEBHOOK] Verification challenge missing", { sourceIp })
    return new NextResponse("Missing hub.challenge", { status: 400 })
  }

  console.warn("[META_WHATSAPP_WEBHOOK] Verification failed", { mode, sourceIp })
  return new NextResponse("Forbidden", { status: 403 })
}

// POST - incoming messages from Meta. Authentication OTP templates still require a physical
// phone number at send time, so OTP dispatch should continue to use a stored phoneNumber/mobile
// even when inbound replies arrive with a BSUID-only whatsappId.
export async function POST(request: NextRequest) {
  try {
    const sourceIp = getRequestSourceIp(request)
    const body = (await request.json()) as MetaWebhookPayload
    const results = await processWebhookPayload(body)

    console.log("[META_WHATSAPP_WEBHOOK]", JSON.stringify({ sourceIp, results }, null, 2))

    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (error) {
    console.error("[META_WHATSAPP_WEBHOOK_ERROR]", error)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }
}