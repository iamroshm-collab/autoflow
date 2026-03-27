import { NextRequest, NextResponse } from "next/server"
import { saveNotificationDevice } from "@/services/notificationService"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const employeeId = Number(body.employeeId ?? body.technicianId)
    const rawPlayerId = body.oneSignalPlayerId ?? body.token ?? ""
    const oneSignalPlayerId = String(rawPlayerId).trim()

    if (!Number.isInteger(employeeId) || !oneSignalPlayerId) {
      return NextResponse.json(
        { error: "employeeId and oneSignalPlayerId are required" },
        { status: 400 }
      )
    }

    const deviceToken = await saveNotificationDevice(employeeId, oneSignalPlayerId)

    return NextResponse.json({
      success: true,
      message: "OneSignal device registered successfully",
      deviceToken,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to register device token" },
      { status: 500 }
    )
  }
}
