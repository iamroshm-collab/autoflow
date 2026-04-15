import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { generateMonthlyPayrollData } from "@/lib/payroll-generation"

// GET - Fetch monthly payroll records
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month")
    const year = searchParams.get("year")
    const employeeId = searchParams.get("employeeId")
    const summary = searchParams.get("summary")

    const role = String(currentUser.role || "").toLowerCase()

    if (summary === "1" || summary === "true") {
      if (role === "technician") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const grouped = await prisma.monthlyPayroll.groupBy({
        by: ["month", "year"],
        _count: {
          employeeId: true,
        },
        _sum: {
          netSalary: true,
        },
        _max: {
          generatedAt: true,
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      })

      const history = await Promise.all(
        grouped.map(async (item) => {
          const latest = await prisma.monthlyPayroll.findFirst({
            where: {
              month: item.month,
              year: item.year,
            },
            select: {
              generatedBy: true,
              generatedAt: true,
            },
            orderBy: [{ generatedAt: "desc" }, { payrollId: "desc" }],
          })

          return {
            month: item.month,
            year: item.year,
            employeeCount: item._count.employeeId,
            totalAmount: item._sum.netSalary || 0,
            generatedAt: latest?.generatedAt || item._max.generatedAt,
            generatedBy: latest?.generatedBy || "System",
          }
        })
      )

      return NextResponse.json(history)
    }

    if (!month || !year) {
      return NextResponse.json({ error: "Month and year are required" }, { status: 400 })
    }

    const where: any = {
      month: parseInt(month),
      year: parseInt(year),
    }

    if (role === "technician") {
      if (!Number.isInteger(currentUser.employeeRefId)) {
        return NextResponse.json({ error: "Technician account is not linked to an employee" }, { status: 403 })
      }

      const ownEmployeeId = Number(currentUser.employeeRefId)
      if (employeeId && parseInt(employeeId) !== ownEmployeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      where.employeeId = ownEmployeeId
    } else if (employeeId) {
      where.employeeId = parseInt(employeeId)
    }

    let payrolls = await prisma.monthlyPayroll.findMany({
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
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (String(currentUser.role || "").toLowerCase() === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { month, year, generatedBy, regenerate } = body

    if (!month || !year) {
      return NextResponse.json({ error: "Month and year are required" }, { status: 400 })
    }

    const monthNum = parseInt(month)
    const yearNum = parseInt(year)
    if (regenerate === true) {
      await prisma.monthlyPayroll.deleteMany({
        where: {
          month: monthNum,
          year: yearNum,
        },
      })
    }

    const resolvedGeneratedBy =
      String(generatedBy || "").trim() ||
      String((currentUser as any).name || "").trim() ||
      "System"

    const generated = await generateMonthlyPayrollData(monthNum, yearNum, resolvedGeneratedBy)

    return NextResponse.json({
      success: true,
      count: generated.count,
      month: monthNum,
      year: yearNum,
      regenerate: regenerate === true,
      payrolls: generated.payrolls,
    })
  } catch (error) {
    console.error("Error generating payroll:", error)
    return NextResponse.json({ error: "Failed to generate payroll" }, { status: 500 })
  }
}

// DELETE - Delete a payroll record
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (String(currentUser.role || "").toLowerCase() === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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
