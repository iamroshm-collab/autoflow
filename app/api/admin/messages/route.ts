import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type UnknownRecord = Record<string, unknown>

type MonitorMessage = {
  id: string
  senderName: string | null
  phoneNumber: string | null
  content: string
  timestamp: string | null
  status: string
  messageType?: string | null
  isOutgoing?: boolean
  profilePicture?: string | null
}

const toStringOrNull = (value: unknown) => {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const toIsoTimestampOrNull = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return null
}

const normalizeStatus = (row: UnknownRecord) => {
  const status = toStringOrNull(
    row.status ?? row.messageStatus ?? row.deliveryStatus ?? row.state
  )

  if (status) {
    return status
  }

  if (row.repliedAt) {
    return "Replied"
  }

  return "Received"
}

const fetchProfilePictureFromMeta = async (phoneNumber: string | null): Promise<string | null> => {
  if (!phoneNumber) return null

  try {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
    const apiVersion = process.env.META_WHATSAPP_API_VERSION || "v20.0"

    if (!accessToken || !phoneNumberId) {
      return null
    }

    // Clean phone number - remove any non-digits
    const cleanPhone = phoneNumber.replace(/\D/g, "")

    // Call Meta's API to get profile picture
    const response = await fetch(
      `https://graph.instagram.com/${apiVersion}/${cleanPhone}/profile_picture?access_token=${accessToken}`,
      { method: "GET" }
    )

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { data?: { url?: string } }
    return data?.data?.url || null
  } catch {
    return null
  }
}

const normalizeMessage = (row: UnknownRecord, index: number): MonitorMessage => {
  const status = normalizeStatus(row)
  const messageType = toStringOrNull(row.messageType)
  const hasRepliedAt = !!row.repliedAt
  const msgTypeIsOutgoing = messageType?.toLowerCase().includes("outgoing") || messageType?.toLowerCase().includes("sent") || messageType?.toLowerCase().includes("replied")
  const senderIsYou = String(row.senderName ?? "").trim().toLowerCase() === "you"
  const isOutgoing = hasRepliedAt || msgTypeIsOutgoing || senderIsYou
  
  return {
    id: String(row.id ?? row.messageId ?? `row-${index}`),
    senderName: toStringOrNull(
      row.senderName ?? row.sender ?? row.name ?? row.contactName ?? row.customerName
    ),
    phoneNumber: toStringOrNull(
      row.phoneNumber ?? row.phone ?? row.from ?? row.senderPhone ?? row.mobile
    ),
    content:
      toStringOrNull(row.content ?? row.message ?? row.body ?? row.text ?? row.msg) || "",
    timestamp: toIsoTimestampOrNull(
      row.timestamp ?? row.createdAt ?? row.sentAt ?? row.receivedAt ?? row.updatedAt
    ),
    status: status,
    messageType: messageType,
    isOutgoing: isOutgoing,
  }
}

const fetchLatestMessages = async (): Promise<UnknownRecord[]> => {
  const p = prisma as unknown as {
    $queryRawUnsafe: (query: string) => Promise<UnknownRecord[]>
  }

  try {
    const rows = await p.$queryRawUnsafe(
      `SELECT id, "waMessageId" as "messageId", "whatsappId", "phoneNumber", "senderName", content, "messageType", status, "receivedAt" as "createdAt"
       FROM whatsapp_messages
       ORDER BY "receivedAt" DESC
       LIMIT 50`
    )
    if (Array.isArray(rows)) {
      return rows
    }
  } catch {
    // Table may not exist yet
  }

  return []
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { phoneNumber?: string }
    const phone = body.phoneNumber?.trim()
    if (!phone) {
      return NextResponse.json({ error: "phoneNumber required" }, { status: 400 })
    }
    await prisma.whatsappMessage.updateMany({
      where: { phoneNumber: phone, status: "received" },
      data: { status: "seen" },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[ADMIN_MESSAGES_PATCH_ERROR]", error)
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const rows = await fetchLatestMessages()
    const normalized = rows.map((row, index) => normalizeMessage(row, index))

    normalized.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return bTime - aTime
    })

    // Get unique phone numbers
    const uniquePhoneNumbers = Array.from(
      new Set(normalized.map((msg) => msg.phoneNumber).filter(Boolean))
    )

    // Fetch profile pictures for unique contacts
    const profilePictures: Record<string, string | null> = {}
    for (const phoneNumber of uniquePhoneNumbers) {
      if (phoneNumber) {
        profilePictures[phoneNumber] = await fetchProfilePictureFromMeta(phoneNumber)
      }
    }

    // Add profile pictures to normalized messages
    const messagesWithPictures = normalized.map((msg) => ({
      ...msg,
      profilePicture: msg.phoneNumber ? profilePictures[msg.phoneNumber] : null,
    }))

    return NextResponse.json({
      messages: messagesWithPictures.slice(0, 50),
      total: Math.min(messagesWithPictures.length, 50),
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[ADMIN_MESSAGES_GET_ERROR]", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}
