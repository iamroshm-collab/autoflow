import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { clampPercentage, normalizeGenderRestriction } from "@/lib/leave-management"

const prismaClient = prisma as any

const canManageLeaveTypes = (role: string) => role === "admin" || role === "manager"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String(user.role || "").toLowerCase()
    if (!canManageLeaveTypes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const updated = await prismaClient.leaveType.update({
      where: { id },
      data: {
        leaveName: body.leave_name != null || body.leaveName != null
          ? String(body.leave_name ?? body.leaveName || "").trim()
          : undefined,
        leaveCode: body.leave_code != null || body.leaveCode != null
          ? String(body.leave_code ?? body.leaveCode || "").trim().toUpperCase()
          : undefined,
        maxDaysPerYear: body.max_days_per_year != null || body.maxDaysPerYear != null
          ? Math.max(0, Number(body.max_days_per_year ?? body.maxDaysPerYear ?? 0))
          : undefined,
        paidPercentage: body.paid_percentage != null || body.paidPercentage != null
          ? clampPercentage(body.paid_percentage ?? body.paidPercentage, 100)
          : undefined,
        requiresApproval: body.requires_approval != null || body.requiresApproval != null
          ? Boolean(body.requires_approval ?? body.requiresApproval)
          : undefined,
        genderRestriction: body.gender_restriction != null || body.genderRestriction != null
          ? normalizeGenderRestriction(body.gender_restriction ?? body.genderRestriction)
          : undefined,
        isActive: body.is_active != null ? Boolean(body.is_active) : undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[LEAVE_TYPES_ID_PUT]", error)
    return NextResponse.json({ error: "Failed to update leave type" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String(user.role || "").toLowerCase()
    if (!canManageLeaveTypes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    await prismaClient.leaveType.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[LEAVE_TYPES_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to deactivate leave type" }, { status: 500 })
  }
}
