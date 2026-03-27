import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  void request
  return NextResponse.json(
    { error: "Password reset is disabled. Use WhatsApp OTP login." },
    { status: 410 }
  )
}