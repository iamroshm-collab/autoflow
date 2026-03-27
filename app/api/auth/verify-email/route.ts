import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  void request
  return NextResponse.json(
    { error: "Email verification is disabled. Registration uses WhatsApp OTP." },
    { status: 410 }
  )
}