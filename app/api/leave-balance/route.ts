import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

const toEmployeeId = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const canManage = (role: string) => role === "admin" || role === "manager"

async function ensureBalancesForEmployee(employeeId: number) {
  const leaveTypes = await prismaClient.leaveType.findMany({ where: { isActive: true } })

  for (const leaveType of leaveTypes) {
    const totalDays = Number(leaveType.maxDaysPerYear || 0)
    try {
      await prismaClient.employeeLeaveBalance.upsert({
        where: { employeeId_leaveTypeId: { employeeId, leaveTypeId: leaveType.id } },
        create: {
          employeeId,
          leaveTypeId: leaveType.id,
          totalDays,
          usedDays: 0,
          remainingDays: totalDays,
        },
        update: {
          totalDays,
        },
      })
    } catch {
      // Ignore unique constraint races — a concurrent request already created the record
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const requestedEmployeeId = toEmployeeId(request.nextUrl.searchParams.get("employeeId"))
    const role = String(user.role || "").toLowerCase()

    let employeeId: number | null = null
    if (canManage(role)) {
      employeeId = requestedEmployeeId ?? toEmployeeId((user as any).employeeRefId)
    } else {
      employeeId = toEmployeeId((user as any).employeeRefId)
      if (!employeeId) {
        return NextResponse.json({ error: "Employee profile not linked" }, { status: 403 })
      }
      if (requestedEmployeeId && requestedEmployeeId !== employeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 })
    }

    await ensureBalancesForEmployee(employeeId)

    const balances = await prismaClient.employeeLeaveBalance.findMany({
      where: { employeeId },
      include: {
        leaveType: true,
      },
      orderBy: [{ leaveType: { leaveName: "asc" } }],
    })

    return NextResponse.json({ employeeId, balances })
  } catch (error) {
    console.error("[LEAVE_BALANCE_GET]", error)
    return NextResponse.json({ error: "Failed to fetch leave balances" }, { status: 500 })
  }
}
