import { NextRequest, NextResponse } from "next/server"
import { sendNotificationToEmployees, sendNotificationToRoles } from "@/services/notificationService"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = String(body?.title || "").trim()
    const bodyText = String(body?.body || "").trim()
    const url = String(body?.url || "").trim() || undefined
    const roles = Array.isArray(body?.roles) ? body.roles : []
    const employeeIds = Array.isArray(body?.employeeIds)
      ? body.employeeIds.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value))
      : []
    const data = body?.data && typeof body.data === "object" ? body.data : {}

    if (!title || !bodyText) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 })
    }

    if (roles.length > 0) {
      await sendNotificationToRoles(roles, {
        title,
        body: bodyText,
        url,
        data,
      })
    }

    if (employeeIds.length > 0) {
      await sendNotificationToEmployees(employeeIds, {
        title,
        body: bodyText,
        url,
        data,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[NOTIFICATIONS_SEND_POST]", error)
    const message = error instanceof Error ? error.message : "Failed to send notification"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}