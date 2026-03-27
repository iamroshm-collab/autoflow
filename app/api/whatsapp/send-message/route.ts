import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendMetaWhatsappText } from "@/lib/meta-whatsapp"

export const dynamic = "force-dynamic"

type SendMessageRequest = {
  to?: string
  message?: string
}

export async function POST(request: Request) {
  let savedMessageId: string | null = null
  
  try {
    const body = (await request.json()) as SendMessageRequest
    const to = String(body?.to || "").trim()
    const message = String(body?.message || "").trim()

    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: "'to' and 'message' are required" },
        { status: 400 }
      )
    }

    // Send the message via Meta WhatsApp API
    const metaResult = await sendMetaWhatsappText({ to, message })

    // Save the sent message to database immediately
    const savedMessage = await prisma.whatsappMessage.create({
      data: {
        waMessageId: metaResult?.messages?.[0]?.id || undefined,
        whatsappId: to,
        phoneNumber: to,
        senderName: "You",
        content: message,
        messageType: "outgoing",
        status: "sent",
        receivedAt: new Date(),
      },
    })

    savedMessageId = savedMessage.id

    return NextResponse.json({
      success: true,
      message: "WhatsApp message sent successfully",
      data: metaResult,
      savedMessage: {
        id: savedMessage.id,
        phoneNumber: savedMessage.phoneNumber,
        content: savedMessage.content,
        status: savedMessage.status,
        messageType: savedMessage.messageType,
        receivedAt: savedMessage.receivedAt,
        isOutgoing: true,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send WhatsApp message"
    console.error("[WHATSAPP_SEND_MESSAGE_POST]", error)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
