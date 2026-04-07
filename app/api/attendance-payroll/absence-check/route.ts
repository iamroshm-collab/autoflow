import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { getTodayISODateInIndia } from "@/lib/utils"

const DEFAULT_HOURS_AFTER_START = Number(process.env.ABSENCE_HOURS_AFTER_START ?? 3)

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    const cronSecret = request.headers.get("x-cron-secret")

    if (!(currentUser && (currentUser.role === "admin")) && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(request.url)
    const dateParam = url.searchParams.get("date") || getTodayISODateInIndia()

    // If date is a holiday, skip
    const holiday = await prisma.holiday.findUnique({ where: { date: dateParam } })
    if (holiday) {
      return NextResponse.json({ date: dateParam, markedAbsent: [], skippedPresent: 0, skippedHoliday: true })
    }

    const markedAbsent: string[] = []
    let skippedPresent = 0

    const employees = await prisma.employee.findMany({ where: { isAttendanceEligible: true, isArchived: false } })

    for (const emp of employees) {
      // Fetch shift or defaults
      const empShift = await prisma.employeeShift.findUnique({ where: { employeeId: emp.employeeId } })
      const shiftStart = empShift?.shiftStart ?? process.env.DEFAULT_SHIFT_START ?? "09:00"
      const absenceHours = Number(process.env.ABSENCE_HOURS_AFTER_START ?? DEFAULT_HOURS_AFTER_START)

      // Compute absence deadline as shiftStart + absenceHours
      const [hh, mm] = shiftStart.split(":").map((s) => Number(s))
      if (!Number.isInteger(hh) || !Number.isInteger(mm)) continue

      // Build a Date for the deadline in IST by using the dateParam
      const [y, mon, d] = dateParam.split("-").map((p) => Number(p))
      const deadline = new Date(Date.UTC(y, mon - 1, d, hh + absenceHours, mm, 0) - (5 * 60 + 30) * 60 * 1000)

      const now = new Date()
      if (now < deadline) {
        // Not yet past deadline
        continue
      }

      // Check if attendance record exists with checkInAt
      const targetDate = new Date(Date.UTC(y, mon - 1, d, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000)
      const existing = await prisma.attendancePayroll.findFirst({ where: { employeeId: emp.employeeId, attendanceDate: targetDate } })
      if (existing && existing.checkInAt) {
        skippedPresent += 1
        continue
      }

      if (existing && existing.attendance === "A") {
        continue
      }

      // Upsert absent record
      await prisma.attendancePayroll.upsert({
        where: { employeeId_attendanceDate: { employeeId: emp.employeeId, attendanceDate: targetDate } },
        update: { attendance: "A" },
        create: { employeeId: emp.employeeId, attendanceDate: targetDate, attendance: "A" },
      })

      markedAbsent.push(emp.empName)
    }

    return NextResponse.json({ date: dateParam, markedAbsent, skippedPresent, skippedHoliday: false })
  } catch (err) {
    console.error("/absence-check error", err)
    return NextResponse.json({ error: "Failed to run absence check" }, { status: 500 })
  }
}
