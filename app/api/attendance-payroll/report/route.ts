import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deriveAttendanceCode, normalizeAttendanceCode } from "@/lib/attendance"

export async function GET(request: NextRequest) {
  try {
    const employeeId = Number(request.nextUrl.searchParams.get("employeeId"))
    const month = Number(request.nextUrl.searchParams.get("month"))
    const year = Number(request.nextUrl.searchParams.get("year"))

    if (!Number.isInteger(employeeId) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return NextResponse.json(
        { error: "EmployeeID, Month, and Year are required" },
        { status: 400 }
      )
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Month must be between 1 and 12" }, { status: 400 })
    }

    const [employee, attendanceRows] = await Promise.all([
      prisma.employee.findUnique({ where: { employeeId } }),
      prisma.attendancePayroll.findMany({
        where: {
          employeeId,
          attendanceDate: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
        orderBy: [{ attendanceDate: "asc" }, { attendanceId: "asc" }],
      }),
    ])

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const presentDays = attendanceRows.filter(
      (row) =>
        (row.workedMinutes != null
          ? deriveAttendanceCode(row.workedMinutes)
          : normalizeAttendanceCode(row.attendance)) === "P"
    ).length

    const attendanceIncentive = attendanceRows.reduce((sum, row) => sum + Number(row.incentive || 0), 0)
    const allowances = attendanceRows.reduce((sum, row) => sum + Number(row.allowance || 0), 0)
    const salaryAdvance = attendanceRows.reduce((sum, row) => sum + Number(row.salaryAdvance || 0), 0)

    const jobCardIncentiveAggregate = await prisma.employeeEarning.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        transactionDate: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
        OR: [
          { employeeID: String(employee.employeeId) },
          { employeeID: employee.idNumber },
          { employee: employee.empName },
        ],
      },
    })

    const jobCardIncentive = Number(jobCardIncentiveAggregate._sum.amount || 0)
    const grossFromPresentDays = presentDays * Number(employee.salaryPerday || 0)
    const totalIncentives = attendanceIncentive + jobCardIncentive
    const netSalary = grossFromPresentDays + totalIncentives + allowances - salaryAdvance

    return NextResponse.json({
      employee: {
        employeeId: employee.employeeId,
        empName: employee.empName,
        designation: employee.designation,
        mobile: employee.mobile,
        salaryPerday: employee.salaryPerday,
      },
      period: {
        month,
        year,
      },
      summary: {
        presentDays,
        grossFromPresentDays,
        attendanceIncentive,
        jobCardIncentive,
        totalIncentives,
        allowances,
        salaryAdvance,
        netSalary,
      },
      entries: attendanceRows,
    })
  } catch (error) {
    console.error("[ATTENDANCE_PAYROLL_REPORT_GET]", error)
    return NextResponse.json({ error: "Failed to generate salary report" }, { status: 500 })
  }
}
