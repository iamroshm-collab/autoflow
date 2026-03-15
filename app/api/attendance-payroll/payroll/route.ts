import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deriveAttendanceCode, isAdminLikeDesignation, normalizeAttendanceCode } from "@/lib/attendance"

// GET - Fetch monthly payroll records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month")
    const year = searchParams.get("year")
    const employeeId = searchParams.get("employeeId")

    if (!month || !year) {
      return NextResponse.json({ error: "Month and year are required" }, { status: 400 })
    }

    const where: any = {
      month: parseInt(month),
      year: parseInt(year),
    }

    if (employeeId) {
      where.employeeId = parseInt(employeeId)
    }

    const payrolls = await prisma.monthlyPayroll.findMany({
      where,
      include: {
        employee: {
          select: {
            empName: true,
            idNumber: true,
            designation: true,
            salaryPerday: true,
          },
        },
      },
      orderBy: {
        employee: {
          empName: "asc",
        },
      },
    })

    return NextResponse.json(payrolls)
  } catch (error) {
    console.error("Error fetching payroll:", error)
    return NextResponse.json({ error: "Failed to fetch payroll" }, { status: 500 })
  }
}

// POST - Generate monthly payroll
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { month, year, generatedBy } = body

    if (!month || !year) {
      return NextResponse.json({ error: "Month and year are required" }, { status: 400 })
    }

    const monthNum = parseInt(month)
    const yearNum = parseInt(year)

    // Get all active employees
    const employees = await prisma.$queryRaw<Array<{
      employeeId: number
      empName: string
      designation: string | null
      salaryPerday: number
      isAttendanceEligible: boolean
    }>>`
      SELECT "employeeId", "empName", "designation", "salaryPerday", "isAttendanceEligible"
      FROM "Employee"
      WHERE "isArchived" = false
    `

    // Calculate date range for the month
    const startDate = new Date(yearNum, monthNum - 1, 1)
    const endDate = new Date(yearNum, monthNum, 0)
    endDate.setHours(23, 59, 59, 999)

    const payrollResults = []

    for (const employee of employees) {
      if (employee.isAttendanceEligible === false || isAdminLikeDesignation(employee.designation)) {
        continue
      }

      // Get attendance records for the month
      const attendanceRecords = await prisma.$queryRaw<Array<{ attendance: string; workedMinutes: number | null }>>`
        SELECT "attendance", "workedMinutes"
        FROM "AttendancePayroll"
        WHERE "employeeId" = ${employee.employeeId}
          AND "attendanceDate" >= ${startDate}
          AND "attendanceDate" <= ${endDate}
      `

      // Count attendance types
      let totalPresent = 0
      let totalHalfDay = 0
      let totalLeave = 0
      let totalAbsent = 0

      attendanceRecords.forEach((record) => {
        const normalizedAttendance = record.workedMinutes != null
          ? deriveAttendanceCode(record.workedMinutes)
          : normalizeAttendanceCode(record.attendance)

        switch (normalizedAttendance) {
          case "P":
            totalPresent++
            break
          case "H":
            totalHalfDay++
            break
          case "L":
            totalLeave++
            break
          case "A":
            totalAbsent++
            break
        }
      })

      // Get adjustments for the month
      const adjustments = await prisma.adjustment.findMany({
        where: {
          employeeId: employee.employeeId,
          adjustmentDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      })

      // Calculate totals by type
      let totalAllowance = 0
      let totalIncentive = 0
      let totalAdvance = 0

      adjustments.forEach((adj) => {
        switch (adj.adjustmentType) {
          case "Allowance":
            totalAllowance += adj.amount
            break
          case "Incentive":
            totalIncentive += adj.amount
            break
          case "Advance":
            totalAdvance += adj.amount
            break
        }
      })

      // Calculate basic salary based on attendance
      // P = full day, H = half day, L = full pay (leave), A = no pay
      const workingDays = totalPresent + totalHalfDay * 0.5 + totalLeave
      const basicSalary = workingDays * employee.salaryPerday

      // Calculate net salary
      const netSalary = basicSalary + totalAllowance + totalIncentive - totalAdvance

      // Check if payroll already exists
      const existing = await prisma.monthlyPayroll.findUnique({
        where: {
          employeeId_month_year: {
            employeeId: employee.employeeId,
            month: monthNum,
            year: yearNum,
          },
        },
      })

      let payroll
      if (existing) {
        // Update existing payroll
        payroll = await prisma.monthlyPayroll.update({
          where: {
            payrollId: existing.payrollId,
          },
          data: {
            basicSalary,
            totalPresent,
            totalHalfDay,
            totalLeave,
            totalAbsent,
            totalAllowance,
            totalIncentive,
            totalAdvance,
            netSalary,
            generatedBy: generatedBy || null,
          },
        })
      } else {
        // Create new payroll
        payroll = await prisma.monthlyPayroll.create({
          data: {
            employeeId: employee.employeeId,
            month: monthNum,
            year: yearNum,
            basicSalary,
            totalPresent,
            totalHalfDay,
            totalLeave,
            totalAbsent,
            totalAllowance,
            totalIncentive,
            totalAdvance,
            netSalary,
            generatedBy: generatedBy || null,
          },
        })
      }

      payrollResults.push(payroll)
    }

    return NextResponse.json({
      success: true,
      count: payrollResults.length,
      payrolls: payrollResults,
    })
  } catch (error) {
    console.error("Error generating payroll:", error)
    return NextResponse.json({ error: "Failed to generate payroll" }, { status: 500 })
  }
}

// DELETE - Delete a payroll record
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const payrollId = searchParams.get("payrollId")

    if (!payrollId) {
      return NextResponse.json({ error: "payrollId is required" }, { status: 400 })
    }

    await prisma.monthlyPayroll.delete({
      where: {
        payrollId: parseInt(payrollId),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting payroll:", error)
    return NextResponse.json({ error: "Failed to delete payroll" }, { status: 500 })
  }
}
