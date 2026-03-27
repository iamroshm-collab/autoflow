import { NextRequest, NextResponse } from "next/server"
import { clearSessionCookie, deleteSessionFromRequest } from "@/lib/auth-session"

export async function POST(request: NextRequest) {
  try {
    await deleteSessionFromRequest(request)
    const response = NextResponse.json({ success: true })
    clearSessionCookie(response)
    return response
  } catch (error) {
    console.error("[AUTH_LOGOUT_POST]", error)
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 })
  }
}
