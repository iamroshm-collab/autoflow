/**
 * GET /api/mobile-attendance
 *
 * Returns the attendance details for the currently logged-in employee
 * (or a specific employee for admin/manager roles).
 *
 * Query params:
 *   employeeId (optional) – admin/manager can fetch any employee's data
 *
 * Attendance is now marked via POST /api/attendance/start.
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  deriveNextAttendanceAction,
  formatWorkedDuration,
  isAdminLikeDesignation,
  toDayStart,
  toNextDay,
} from "@/lib/attendance"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

async function getEligibleEmployee(employeeId: number) {
  return prisma.employee.findFirst({
    where: {
      employeeId,
      isArchived: false,
      isAttendanceEligible: true,
    },
    select: {
      employeeId: true,
      empName: true,
      mobile: true,
      designation: true,
      facePhotoUrl: true,
      isAttendanceEligible: true,
    },
  })
}

async function buildAttendanceResponse(employeeId: number) {
  const [employee, lastRecord, todayRecord] = await Promise.all([
    getEligibleEmployee(employeeId),
    prisma.attendancePayroll.findFirst({
      where: { employeeId },
      orderBy: [{ attendanceDate: "desc" }, { attendanceId: "desc" }],
    }),
    prisma.attendancePayroll.findFirst({
      where: {
        employeeId,
        attendanceDate: {
          gte: toDayStart(new Date()),
          lt: toNextDay(new Date()),
        },
      },
    }),
  ])

  return { employee, lastRecord, todayRecord }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminLikeRole = currentUser.role === "admin" || currentUser.role === "manager"
    const employeeIdParam = request.nextUrl.searchParams.get("employeeId")

    // -----------------------------------------------------------------------
    // Admin/manager without an employeeId param → return employee list
    // -----------------------------------------------------------------------
    if (!employeeIdParam && isAdminLikeRole) {
      const employees = await prisma.employee.findMany({
        where: { isArchived: false, isAttendanceEligible: true },
        select: {
          employeeId: true,
          empName: true,
          mobile: true,
          designation: true,
          facePhotoUrl: true,
        },
        orderBy: [{ empName: "asc" }, { employeeId: "asc" }],
      })
      return NextResponse.json(
        employees.filter((e) => !isAdminLikeDesignation(e.designation))
      )
    }

    // -----------------------------------------------------------------------
    // Resolve the target employee
    // -----------------------------------------------------------------------
    let targetEmployeeId: number

    if (employeeIdParam) {
      targetEmployeeId = Number(employeeIdParam)
      if (!Number.isInteger(targetEmployeeId)) {
        return NextResponse.json({ error: "Valid employeeId is required" }, { status: 400 })
      }
      // Non-admins can only access their own record
      if (!isAdminLikeRole) {
        if (!Number.isInteger(currentUser.employeeRefId)) {
          return NextResponse.json(
            { error: "Employee mapping is missing for this account" },
            { status: 400 }
          )
        }
        if (Number(currentUser.employeeRefId) !== targetEmployeeId) {
          return NextResponse.json(
            { error: "You can only access your own attendance" },
            { status: 403 }
          )
        }
      }
    } else {
      // Technician fetching their own record without an explicit employeeId
      if (!Number.isInteger(currentUser.employeeRefId)) {
        return NextResponse.json(
          { error: "Employee mapping is missing for this account" },
          { status: 400 }
        )
      }
      targetEmployeeId = Number(currentUser.employeeRefId)
    }

    const { employee, lastRecord, todayRecord } = await buildAttendanceResponse(targetEmployeeId)

    if (!employee || isAdminLikeDesignation(employee.designation)) {
      return NextResponse.json(
        { error: "Employee is not eligible for attendance" },
        { status: 404 }
      )
    }

    const nextAction = deriveNextAttendanceAction(lastRecord)

    return NextResponse.json({
      employee,
      nextAction,
      todayRecord: todayRecord
        ? {
            attendance: todayRecord.attendance,
            checkInAt: todayRecord.checkInAt?.toISOString() ?? null,
            checkOutAt: todayRecord.checkOutAt?.toISOString() ?? null,
            workedDuration: formatWorkedDuration(todayRecord.workedMinutes),
          }
        : null,
    })
  } catch (error) {
    console.error("[MOBILE_ATTENDANCE_GET]", error)
    return NextResponse.json({ error: "Failed to load attendance details" }, { status: 500 })
  }
}
