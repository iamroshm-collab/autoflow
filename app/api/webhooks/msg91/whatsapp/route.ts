import { NextRequest, NextResponse } from "next/server"

function sanitizeHeaders(headers: Headers) {
  const blockedHeaders = new Set(["authorization", "cookie", "x-api-key"])

  return Object.fromEntries(
    Array.from(headers.entries()).filter(([key]) => !blockedHeaders.has(key.toLowerCase()))
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log("[MSG91_WHATSAPP_WEBHOOK]", {
      headers: sanitizeHeaders(request.headers),
      body,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[MSG91_WHATSAPP_WEBHOOK_ERROR]", error)
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "msg91-whatsapp-webhook" })
}