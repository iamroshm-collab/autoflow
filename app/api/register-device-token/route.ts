import { NextRequest, NextResponse } from "next/server"
import { saveDeviceToken } from "@/services/firebaseNotificationService"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const technicianId = Number(body.technicianId)
    const token = String(body.token || "").trim()
    const deviceType = String(body.deviceType || "web").trim() || "web"

    if (!Number.isInteger(technicianId) || !token) {
      return NextResponse.json(
        { error: "technicianId and token are required" },
        { status: 400 }
      )
    }

    const deviceToken = await saveDeviceToken(technicianId, token, deviceType)

    return NextResponse.json({
      success: true,
      message: "Device token registered successfully",
      deviceToken,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to register device token" },
      { status: 500 }
    )
  }
}
