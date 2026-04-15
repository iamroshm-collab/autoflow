import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { clampPercentage, normalizeGenderRestriction } from "@/lib/leave-management"

const prismaClient = prisma as any

const canManageLeaveTypes = (role: string) => role === "admin" || role === "manager"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true"

    const leaveTypes = await prismaClient.leaveType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ leaveName: "asc" }],
    })

    return NextResponse.json(leaveTypes)
  } catch (error) {
    console.error("[LEAVE_TYPES_GET]", error)
    return NextResponse.json({ error: "Failed to fetch leave types" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String(user.role || "").toLowerCase()
    if (!canManageLeaveTypes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const leaveName = String(body.leave_name ?? body.leaveName ?? "").trim()
    const leaveCode = String(body.leave_code ?? body.leaveCode ?? "").trim().toUpperCase()

    if (!leaveName || !leaveCode) {
      return NextResponse.json({ error: "leave_name and leave_code are required" }, { status: 400 })
    }

    const created = await prismaClient.leaveType.create({
      data: {
        leaveName,
        leaveCode,
        maxDaysPerYear: Math.max(0, Number(body.max_days_per_year ?? body.maxDaysPerYear ?? 0)),
        paidPercentage: clampPercentage(body.paid_percentage ?? body.paidPercentage, 100),
        requiresApproval: Boolean(body.requires_approval ?? body.requiresApproval ?? true),
        genderRestriction: normalizeGenderRestriction(body.gender_restriction ?? body.genderRestriction),
        isActive: body.is_active == null ? true : Boolean(body.is_active),
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("[LEAVE_TYPES_POST]", error)
    return NextResponse.json({ error: "Failed to create leave type" }, { status: 500 })
  }
}
