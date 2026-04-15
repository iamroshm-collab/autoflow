import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let facePhotoUrl: string | null = null
    let department: string | null = null
    let designation: string | null = null
    const employeeRefId = (user as any).employeeRefId
    if (employeeRefId && Number.isInteger(Number(employeeRefId))) {
      const emp = await prismaClient.employee.findUnique({
        where: { employeeId: Number(employeeRefId) },
        select: { facePhotoUrl: true, department: true, designation: true },
      })
      facePhotoUrl = emp?.facePhotoUrl ?? null
      department = emp?.department ?? null
      designation = emp?.designation ?? null
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
        facePhotoUrl,
        department,
        designation,
      },
    })
  } catch (error) {
    console.error("[AUTH_ME_GET]", error)
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
  }
}
