import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        employeeRefId: user.employeeRefId,
        approvalStatus: user.approvalStatus,
        approvedDeviceId: (user as any).approvedDeviceId ?? null,
        approvedDeviceIp: (user as any).approvedDeviceIp ?? null,
        pendingDeviceId: (user as any).pendingDeviceId ?? null,
        pendingDeviceIp: (user as any).pendingDeviceIp ?? null,
        deviceApprovalStatus: (user as any).deviceApprovalStatus ?? "none",
        profileIncomplete: false,
      },
    })
  } catch (error) {
    console.error("[AUTH_ME_GET]", error)
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
  }
}
