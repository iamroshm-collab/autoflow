import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import {
  calculateLeaveDaysInclusive,
  clampPercentage,
  normalizeLeaveStatus,
} from "@/lib/leave-management"
import { createRoleNotifications } from "@/lib/app-notifications"

const prismaClient = prisma as any

const canManage = (role: string) => role === "admin" || role === "manager"

const toEmployeeId = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

async function ensureBalance(employeeId: number, leaveType: any) {
  const existing = await prismaClient.employeeLeaveBalance.findFirst({
    where: { employeeId, leaveTypeId: leaveType.id },
  })

  if (existing) {
    return existing
  }

  return prismaClient.employeeLeaveBalance.create({
    data: {
      employeeId,
      leaveTypeId: leaveType.id,
      totalDays: Number(leaveType.maxDaysPerYear || 0),
      usedDays: 0,
      remainingDays: Number(leaveType.maxDaysPerYear || 0),
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = String(user.role || "").toLowerCase()
    const search = request.nextUrl.searchParams
    const status = normalizeLeaveStatus(search.get("status") || "")
    const requestedEmployeeId = toEmployeeId(search.get("employeeId"))

    const where: any = {}
    if (search.get("status")) {
      where.status = status
    }

    if (canManage(role)) {
      if (requestedEmployeeId) {
        where.employeeId = requestedEmployeeId
      }
    } else {
      const ownEmployeeId = toEmployeeId((user as any).employeeRefId)
      if (!ownEmployeeId) {
        return NextResponse.json({ error: "Employee profile not linked" }, { status: 403 })
      }
      if (requestedEmployeeId && requestedEmployeeId !== ownEmployeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      where.employeeId = ownEmployeeId
    }

    const requests = await prismaClient.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            employeeId: true,
            empName: true,
            mobile: true,
          },
        },
        leaveType: true,
      },
      orderBy: [{ requestedAt: "desc" }],
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("[LEAVE_REQUESTS_GET]", error)
    return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = String(user.role || "").toLowerCase()
    const body = await request.json()

    const ownEmployeeId = toEmployeeId((user as any).employeeRefId)
    const requestedEmployeeId = toEmployeeId(body.employee_id ?? body.employeeId)

    let employeeId: number | null = null
    if (canManage(role) && requestedEmployeeId) {
      employeeId = requestedEmployeeId
    } else {
      employeeId = ownEmployeeId
    }

    if (!employeeId) {
      return NextResponse.json({ error: "Employee profile not linked" }, { status: 403 })
    }

    const leaveTypeId = String(body.leave_type_id ?? body.leaveTypeId ?? "").trim()
    const startDate = String(body.start_date ?? body.startDate ?? "").trim()
    const endDate = String(body.end_date ?? body.endDate ?? "").trim()
    const reason = String(body.reason || "").trim()

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: "leave_type, start_date, end_date and reason are required" },
        { status: 400 }
      )
    }

    const totalDays = calculateLeaveDaysInclusive(startDate, endDate)
    if (!totalDays) {
      return NextResponse.json({ error: "Invalid start_date/end_date" }, { status: 400 })
    }

    const leaveType = await prismaClient.leaveType.findUnique({ where: { id: leaveTypeId } })
    if (!leaveType || !leaveType.isActive) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 })
    }

    const balance = await ensureBalance(employeeId, leaveType)

    // For limited leave types, block when balance is insufficient.
    const isUnlimited = Number(leaveType.maxDaysPerYear || 0) >= 365
    if (!isUnlimited && Number(balance.remainingDays || 0) < totalDays) {
      return NextResponse.json(
        { error: `Insufficient leave balance. Remaining: ${Number(balance.remainingDays || 0)}` },
        { status: 400 }
      )
    }

    const leaveRequest = await prismaClient.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date(`${startDate}T00:00:00`),
        endDate: new Date(`${endDate}T00:00:00`),
        totalDays,
        reason,
        status: "pending",
      },
      include: {
        employee: {
          select: {
            empName: true,
          },
        },
        leaveType: true,
      },
    })

    try {
      await createRoleNotifications(["admin", "manager"], {
        title: "Leave request submitted",
        body: `Leave request submitted by ${leaveRequest.employee.empName} (${leaveRequest.leaveType.leaveName}, ${leaveRequest.totalDays} days).`,
        targetForm: "approvals",
        refType: "leave_request",
        refId: leaveRequest.id,
        type: "info",
      })
    } catch (notificationError) {
      console.warn("[LEAVE_REQUESTS_POST_NOTIFY]", notificationError)
    }

    return NextResponse.json({ request: leaveRequest }, { status: 201 })
  } catch (error) {
    console.error("[LEAVE_REQUESTS_POST]", error)
    return NextResponse.json({ error: "Failed to submit leave request" }, { status: 500 })
  }
}
