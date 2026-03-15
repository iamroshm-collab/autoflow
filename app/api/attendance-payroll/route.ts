import { NextRequest, NextResponse } from "next/server"

// Minimal stubbed API handler to satisfy TypeScript during development.
// Replace with full implementation when ready.

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({ received: true, body })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({ updated: true, body })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
