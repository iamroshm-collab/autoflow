import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { createUserNotification, removeNotificationsByRef } from "@/lib/app-notifications"
import { enumerateISODateRange, toIndiaDayStart } from "@/lib/leave-management"

const prismaClient = prisma as any

const canManage = (role: string) => role === "admin" || role === "manager"

const toISODateInIndia = (value: Date) => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(value)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = String(user.role || "").toLowerCase()
    if (!canManage(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const action = String(body.action || "").trim().toLowerCase()

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 })
    }

    const existing = await prismaClient.leaveRequest.findUnique({
      where: { id },
      include: {
        leaveType: true,
        employee: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    if (String(existing.status || "").toLowerCase() !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be updated" }, { status: 400 })
    }

    const approverIdentity =
      String((user as any).name || "").trim() ||
      String((user as any).email || "").trim() ||
      String((user as any).id || "").trim() ||
      "system"

    const requestUpdated = await prismaClient.$transaction(async (tx: any) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: action === "approve" ? "approved" : "rejected",
          approvedBy: approverIdentity,
          approvalDate: new Date(),
        },
        include: {
          leaveType: true,
          employee: true,
        },
      })

      if (action === "approve") {
        const maxTotal = Number(updated.leaveType.maxDaysPerYear || 0)
        const paidPercent = Math.max(0, Math.min(100, Number(updated.leaveType.paidPercentage || 0)))

        const existingBalance = await tx.employeeLeaveBalance.findFirst({
          where: {
            employeeId: updated.employeeId,
            leaveTypeId: updated.leaveTypeId,
          },
        })

        if (existingBalance) {
          const usedDays = Number(existingBalance.usedDays || 0) + Number(updated.totalDays || 0)
          const remainingDays = Math.max(0, maxTotal - usedDays)
          await tx.employeeLeaveBalance.update({
            where: { id: existingBalance.id },
            data: {
              totalDays: maxTotal,
              usedDays,
              remainingDays,
            },
          })
        } else {
          await tx.employeeLeaveBalance.create({
            data: {
              employeeId: updated.employeeId,
              leaveTypeId: updated.leaveTypeId,
              totalDays: maxTotal,
              usedDays: Number(updated.totalDays || 0),
              remainingDays: Math.max(0, maxTotal - Number(updated.totalDays || 0)),
            },
          })
        }

        const startIso = toISODateInIndia(new Date(updated.startDate))
        const endIso = toISODateInIndia(new Date(updated.endDate))
        const dateRange = enumerateISODateRange(startIso, endIso)

        for (const dateIso of dateRange) {
          const attendanceDate = toIndiaDayStart(dateIso)
          if (!attendanceDate) continue

          const currentAttendance = await tx.attendancePayroll.findFirst({
            where: {
              employeeId: updated.employeeId,
              attendanceDate,
            },
          })

          const leaveCode = updated.leaveType.leaveCode

          if (currentAttendance && (currentAttendance.checkInAt || currentAttendance.checkOutAt)) {
            // Record has check-in/out — update only the attendance status, preserve times
            await tx.attendancePayroll.update({
              where: { attendanceId: currentAttendance.attendanceId },
              data: { attendance: leaveCode },
            })
          } else {
            await tx.attendancePayroll.upsert({
              where: {
                employeeId_attendanceDate: {
                  employeeId: updated.employeeId,
                  attendanceDate,
                },
              },
              update: {
                attendance: leaveCode,
                workedMinutes: null,
                checkInAt: null,
                checkOutAt: null,
                incentive: currentAttendance?.incentive ?? 0,
                allowance: currentAttendance?.allowance ?? 0,
                salaryAdvance: currentAttendance?.salaryAdvance ?? 0,
              },
              create: {
                employeeId: updated.employeeId,
                attendanceDate,
                attendance: leaveCode,
                workedMinutes: null,
                attendanceMethod: "leave_request",
                allowance: 0,
                incentive: 0,
                salaryAdvance: 0,
              },
            })
          }

          // If this is unpaid/partially paid leave, store daily deduction preview in allowance as a negative marker is not desired.
          // Deduction is computed during payroll using leave type paid percentage.
          void paidPercent
        }
      }

      return updated
    })

    try {
      const targetUser = await prismaClient.appUser.findFirst({
        where: { employeeRefId: requestUpdated.employeeId },
        select: { id: true },
      })

      if (targetUser?.id) {
        const startIso = toISODateInIndia(new Date(requestUpdated.startDate))
        const endIso = toISODateInIndia(new Date(requestUpdated.endDate))
        const bodyText = action === "approve"
          ? `Your ${requestUpdated.leaveType.leaveName} from ${startIso} to ${endIso} has been approved.`
          : `Your ${requestUpdated.leaveType.leaveName} request from ${startIso} to ${endIso} has been rejected.`

        await createUserNotification(targetUser.id, {
          title: action === "approve" ? "Leave Approved" : "Leave Rejected",
          body: bodyText,
          refType: "leave_request",
          refId: requestUpdated.id,
          type: action === "approve" ? "success" : "warning",
        })
      }
    } catch (notifyError) {
      console.error("[LEAVE_REQUEST_ACTION_EMP_NOTIFY]", notifyError)
    }

    try {
      await removeNotificationsByRef("leave_request", requestUpdated.id, {
        roles: ["admin", "manager"],
      })
    } catch (removeError) {
      console.error("[LEAVE_REQUEST_ACTION_REMOVE_NOTIFY]", removeError)
    }

    return NextResponse.json({ request: requestUpdated })
  } catch (error) {
    console.error("[LEAVE_REQUEST_ACTION_POST]", error)
    return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 })
  }
}
