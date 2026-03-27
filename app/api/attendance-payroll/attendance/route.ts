import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import {
  calculateWorkedMinutes,
  deriveNextAttendanceAction,
  formatWorkedDuration,
  isAdminLikeDesignation,
  normalizeAttendanceCode,
} from "@/lib/attendance"

const INDIA_TIMEZONE = "Asia/Kolkata"
const INDIA_OFFSET_MINUTES = 5 * 60 + 30
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

const parseIndiaDateParts = (value: string) => {
  const match = String(value || "").trim().match(DATE_ONLY_REGEX)
  if (!match) {
    return null
  }

  const [, yearPart, monthPart, dayPart] = match
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  return { year, month, day }
}

const getIndiaDayStart = (attendanceDate: string) => {
  const parts = parseIndiaDateParts(attendanceDate)
  if (!parts) {
    return null
  }

  const utcTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - INDIA_OFFSET_MINUTES * 60 * 1000
  return new Date(utcTimestamp)
}

const getIndiaDayRange = (attendanceDate: string) => {
  const start = getIndiaDayStart(attendanceDate)
  if (!start) {
    return null
  }

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

const parseOptionalTime = (attendanceDate: string, timeValue?: string | null) => {
  const trimmed = String(timeValue || "").trim()
  if (!trimmed) {
    return null
  }

  const parts = parseIndiaDateParts(attendanceDate)
  if (!parts) {
    return null
  }

  const [hoursPart, minutesPart] = trimmed.split(":")
  const hours = Number(hoursPart)
  const minutes = Number(minutesPart)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  const utcTimestamp = Date.UTC(parts.year, parts.month - 1, parts.day, hours, minutes, 0, 0) - INDIA_OFFSET_MINUTES * 60 * 1000
  return new Date(utcTimestamp)
}

const formatTimeHHMM = (value?: Date | null) => {
  if (!value) {
    return ""
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value)

  const hours = parts.find((part) => part.type === "hour")?.value ?? "00"
  const minutes = parts.find((part) => part.type === "minute")?.value ?? "00"

  return `${hours}:${minutes}`
}

const parseOptionalInt = (value: string | null) => {
  if (value == null || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

const getScopedEmployeeId = async (request: NextRequest, requestedEmployeeId?: number | null) => {
  const currentUser = await getCurrentUserFromRequest(request)
  if (!currentUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const role = String(currentUser.role || "").toLowerCase()
  if (role !== "technician") {
    return {
      employeeId: Number.isInteger(requestedEmployeeId) ? Number(requestedEmployeeId) : null,
      role,
    }
  }

  if (!Number.isInteger(currentUser.employeeRefId)) {
    return {
      error: NextResponse.json({ error: "Technician account is not linked to an employee" }, { status: 403 }),
    }
  }

  const ownEmployeeId = Number(currentUser.employeeRefId)
  if (Number.isInteger(requestedEmployeeId) && Number(requestedEmployeeId) !== ownEmployeeId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { employeeId: ownEmployeeId, role }
}

// GET - Fetch attendance records for a specific date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const month = parseOptionalInt(searchParams.get("month"))
    const year = parseOptionalInt(searchParams.get("year"))
    const requestedEmployeeId = parseOptionalInt(searchParams.get("employeeId"))

    const scoped = await getScopedEmployeeId(request, requestedEmployeeId)
    if ("error" in scoped) {
      return scoped.error
    }

    const scopedEmployeeId = scoped.employeeId

    if (month != null && year != null && Number.isInteger(scopedEmployeeId)) {
      const employeeId = Number(scopedEmployeeId)
      const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
      const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))

      const records = await prisma.attendancePayroll.findMany({
        where: {
          employeeId,
          attendanceDate: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
        select: {
          attendanceDate: true,
          attendance: true,
          workedMinutes: true,
          checkInAt: true,
          checkOutAt: true,
        },
        orderBy: {
          attendanceDate: "asc",
        },
      })

      const normalized = records.map((record) => ({
        date: new Intl.DateTimeFormat("en-CA", { timeZone: INDIA_TIMEZONE }).format(record.attendanceDate),
        attendance: normalizeAttendanceCode(record.attendance),
        workedMinutes: record.workedMinutes,
        workedDuration: formatWorkedDuration(record.workedMinutes),
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
      }))

      return NextResponse.json({ employeeId, month, year, records: normalized })
    }

    if (!date) {
      return NextResponse.json({ error: "Date parameter required" }, { status: 400 })
    }

    const dayRange = getIndiaDayRange(date)
    if (!dayRange) {
      return NextResponse.json({ error: "Invalid date format. Expected YYYY-MM-DD" }, { status: 400 })
    }

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: {
        isArchived: false,
        isAttendanceEligible: true,
        ...(Number.isInteger(scopedEmployeeId) ? { employeeId: Number(scopedEmployeeId) } : {}),
      },
      select: {
        employeeId: true,
        empName: true,
        idNumber: true,
        designation: true,
        salaryPerday: true,
        facePhotoUrl: true,
      },
      orderBy: {
        empName: "asc",
      },
    })

    // Get attendance records for the date
    const attendanceRecords = await prisma.attendancePayroll.findMany({
      where: {
        attendanceDate: {
          gte: dayRange.start,
          lt: dayRange.end,
        },
        ...(Number.isInteger(scopedEmployeeId) ? { employeeId: Number(scopedEmployeeId) } : {}),
      },
      include: {
        employee: {
          select: {
            empName: true,
            idNumber: true,
          },
        },
      },
    })

    // Merge employees with their attendance
    const attendanceData = employees.map((emp) => {
      const record = attendanceRecords.find((r) => r.employeeId === emp.employeeId)
      const computedWorkedMinutes =
        record?.workedMinutes != null
          ? record.workedMinutes
          : record?.checkInAt && record?.checkOutAt
            ? calculateWorkedMinutes(record.checkInAt, record.checkOutAt)
            : null

      return {
        employeeId: emp.employeeId,
        empName: emp.empName,
        idNumber: emp.idNumber,
        designation: emp.designation,
        salaryPerday: emp.salaryPerday,
        facePhotoUrl: emp.facePhotoUrl,
        attendance: record?.attendance || "",
        attendanceId: record?.attendanceId,
        checkInAt: record?.checkInAt || null,
        checkOutAt: record?.checkOutAt || null,
        workedMinutes: computedWorkedMinutes,
        workedDuration: formatWorkedDuration(computedWorkedMinutes),
        attendanceMethod: record?.attendanceMethod || null,
        verificationStatus: record?.verificationStatus || null,
        nextAction: deriveNextAttendanceAction(record),
      }
    })

    return NextResponse.json(attendanceData.filter((employee) => !isAdminLikeDesignation(employee.designation)))
  } catch (error) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 })
  }
}

// POST - Create or update attendance record
export async function POST(request: NextRequest) {
  try {
    const scoped = await getScopedEmployeeId(request)
    if ("error" in scoped) {
      return scoped.error
    }

    if (scoped.role === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { employeeId, attendanceDate, attendance } = body
    const normalizedAttendance = normalizeAttendanceCode(attendance)

    if (!employeeId || !attendanceDate || !attendance) {
      return NextResponse.json(
        { error: "employeeId, attendanceDate, and attendance are required" },
        { status: 400 }
      )
    }

    // Validate attendance value
    if (!["P", "H", "A"].includes(normalizedAttendance)) {
      return NextResponse.json(
        { error: "Attendance must be P, H, or A" },
        { status: 400 }
      )
    }

    const targetDate = getIndiaDayStart(attendanceDate)
    if (!targetDate) {
      return NextResponse.json({ error: "Invalid attendanceDate format. Expected YYYY-MM-DD" }, { status: 400 })
    }

    // Check if record exists
    const existing = await prisma.attendancePayroll.findFirst({
      where: {
        employeeId: parseInt(employeeId),
        attendanceDate: targetDate,
      },
    })

    let result
    if (existing) {
      // Update existing record
      result = await prisma.attendancePayroll.update({
        where: {
          attendanceId: existing.attendanceId,
        },
        data: {
          attendance: normalizedAttendance,
        },
      })
    } else {
      // Create new record
      result = await prisma.attendancePayroll.create({
        data: {
          employeeId: parseInt(employeeId),
          attendanceDate: targetDate,
          attendance: normalizedAttendance,
          salaryAdvance: 0,
          incentive: 0,
          allowance: 0,
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error saving attendance:", error)
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 })
  }
}

// PUT - Bulk update attendance
export async function PUT(request: NextRequest) {
  try {
    const scoped = await getScopedEmployeeId(request)
    if ("error" in scoped) {
      return scoped.error
    }

    if (scoped.role === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { attendanceRecords } = body

    if (!Array.isArray(attendanceRecords)) {
      return NextResponse.json({ error: "attendanceRecords must be an array" }, { status: 400 })
    }

    const results = []
    for (const record of attendanceRecords) {
      const { employeeId, attendanceDate, attendance } = record
      const normalizedAttendance = normalizeAttendanceCode(attendance)

      if (!employeeId || !attendanceDate || !attendance) {
        continue
      }

      if (!["P", "H", "A"].includes(normalizedAttendance)) {
        continue
      }

      const targetDate = getIndiaDayStart(attendanceDate)
      if (!targetDate) {
        continue
      }

      const existing = await prisma.attendancePayroll.findFirst({
        where: {
          employeeId: parseInt(employeeId),
          attendanceDate: targetDate,
        },
      })

      if (existing) {
        const updated = await prisma.attendancePayroll.update({
          where: { attendanceId: existing.attendanceId },
          data: { attendance: normalizedAttendance },
        })
        results.push(updated)
      } else {
        const created = await prisma.attendancePayroll.create({
          data: {
            employeeId: parseInt(employeeId),
            attendanceDate: targetDate,
            attendance: normalizedAttendance,
            salaryAdvance: 0,
            incentive: 0,
            allowance: 0,
          },
        })
        results.push(created)
      }
    }

    return NextResponse.json({ success: true, count: results.length })
  } catch (error) {
    console.error("Error bulk updating attendance:", error)
    return NextResponse.json({ error: "Failed to bulk update attendance" }, { status: 500 })
  }
}

// PATCH - Update a single attendance row (admin use)
export async function PATCH(request: NextRequest) {
  try {
    const scoped = await getScopedEmployeeId(request)
    if ("error" in scoped) {
      return scoped.error
    }

    if (scoped.role === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const attendanceId = Number(body.attendanceId)
    const attendanceDate = String(body.attendanceDate || "").trim()
    const status = normalizeAttendanceCode(String(body.attendance || "").trim())
    const checkInTime = String(body.checkInTime || "").trim()
    const checkOutTime = String(body.checkOutTime || "").trim()
    const workedMinutesRaw = body.workedMinutes

    if (!Number.isInteger(attendanceId)) {
      return NextResponse.json({ error: "Valid attendanceId is required" }, { status: 400 })
    }

    if (!attendanceDate) {
      return NextResponse.json({ error: "attendanceDate is required" }, { status: 400 })
    }

    const existingRecord = await prisma.attendancePayroll.findUnique({
      where: { attendanceId },
      select: {
        attendanceId: true,
        checkInAt: true,
        checkOutAt: true,
      },
    })

    if (!existingRecord) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 })
    }

    const updateData: any = {}

    if (status) {
      if (!["P", "H", "A"].includes(status)) {
        return NextResponse.json({ error: "Attendance must be one of P, H, A" }, { status: 400 })
      }
      updateData.attendance = status
    }

    const parsedCheckInAt = checkInTime ? parseOptionalTime(attendanceDate, checkInTime) : null
    const parsedCheckOutAt = checkOutTime ? parseOptionalTime(attendanceDate, checkOutTime) : null

    const checkInUnchanged =
      Boolean(checkInTime) &&
      Boolean(existingRecord.checkInAt) &&
      formatTimeHHMM(existingRecord.checkInAt) === checkInTime

    const checkOutUnchanged =
      Boolean(checkOutTime) &&
      Boolean(existingRecord.checkOutAt) &&
      formatTimeHHMM(existingRecord.checkOutAt) === checkOutTime

    updateData.checkInAt = checkInUnchanged ? existingRecord.checkInAt : parsedCheckInAt
    updateData.checkOutAt = checkOutUnchanged ? existingRecord.checkOutAt : parsedCheckOutAt

    if (updateData.checkInAt && updateData.checkOutAt && updateData.checkOutAt <= updateData.checkInAt) {
      const sameMinuteInput = Boolean(checkInTime && checkOutTime && checkInTime === checkOutTime)

      if (sameMinuteInput) {
        updateData.checkOutAt = new Date(updateData.checkInAt.getTime() + 60000)
      } else {
        return NextResponse.json(
          { error: "checkOutTime must be later than checkInTime" },
          { status: 400 }
        )
      }
    }

    if (updateData.checkInAt && updateData.checkOutAt) {
      updateData.workedMinutes = calculateWorkedMinutes(updateData.checkInAt, updateData.checkOutAt)
    } else if (workedMinutesRaw === "" || workedMinutesRaw === null || workedMinutesRaw === undefined) {
      updateData.workedMinutes = null
    } else {
      const workedMinutes = Number(workedMinutesRaw)
      if (!Number.isInteger(workedMinutes) || workedMinutes < 0) {
        return NextResponse.json({ error: "workedMinutes must be a non-negative integer" }, { status: 400 })
      }
      updateData.workedMinutes = workedMinutes
    }

    const updated = await prisma.attendancePayroll.update({
      where: { attendanceId },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating attendance row:", error)
    return NextResponse.json({ error: "Failed to update attendance row" }, { status: 500 })
  }
}

// DELETE - Delete a single attendance row (admin use)
export async function DELETE(request: NextRequest) {
  try {
    const scoped = await getScopedEmployeeId(request)
    if ("error" in scoped) {
      return scoped.error
    }

    if (scoped.role === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const attendanceId = Number(searchParams.get("attendanceId"))

    if (!Number.isInteger(attendanceId)) {
      return NextResponse.json({ error: "Valid attendanceId is required" }, { status: 400 })
    }

    await prisma.attendancePayroll.delete({
      where: { attendanceId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting attendance row:", error)
    return NextResponse.json({ error: "Failed to delete attendance row" }, { status: 500 })
  }
}
