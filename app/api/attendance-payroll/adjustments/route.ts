import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

// GET - Fetch adjustments with optional employee filter
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const month = searchParams.get("month")
    const year = searchParams.get("year")
    const search = searchParams.get("search")

    const where: any = {}

    const role = String(currentUser.role || "").toLowerCase()
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

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      where.adjustmentDate = {
        gte: startDate,
        lte: endDate,
      }
    }

    const adjustments = await prisma.adjustment.findMany({
      where,
      include: {
        employee: {
          select: {
            empName: true,
            idNumber: true,
            designation: true,
          },
        },
      },
      orderBy: {
        adjustmentDate: "desc",
      },
    })

    // Client-side filtering if search is provided
    let filteredAdjustments = adjustments
    if (search) {
      const searchLower = search.toLowerCase()
      filteredAdjustments = adjustments.filter((adj) =>
        adj.employee.empName.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json(filteredAdjustments)
  } catch (error) {
    console.error("Error fetching adjustments:", error)
    return NextResponse.json({ error: "Failed to fetch adjustments" }, { status: 500 })
  }
}

// POST - Create a new adjustment
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
    const { employeeId, adjustmentType, amount, adjustmentDate, remarks } = body

    if (!employeeId || !adjustmentType || !amount || !adjustmentDate) {
      return NextResponse.json(
        { error: "employeeId, adjustmentType, amount, and adjustmentDate are required" },
        { status: 400 }
      )
    }

    // Validate adjustment type
    const validTypes = ["Allowance", "Advance", "Incentive", "Deduction", "PF", "ESI", "Tax"]
    if (!validTypes.includes(adjustmentType)) {
      return NextResponse.json(
        { error: "adjustmentType must be Allowance, Advance, Incentive, Deduction, PF, ESI, or Tax" },
        { status: 400 }
      )
    }

    const adjDate = new Date(adjustmentDate)

    const adjustment = await prisma.adjustment.create({
      data: {
        employeeId: parseInt(employeeId),
        adjustmentType,
        amount: parseFloat(amount),
        adjustmentDate: adjDate,
        remarks: remarks || null,
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

    // Auto-create ledger expense entry for Allowance, Advance, Incentive
    if (["Allowance", "Advance", "Incentive"].includes(adjustmentType)) {
      const monthName = adjDate.toLocaleString("en-IN", { month: "long" })
      const year = adjDate.getFullYear()
      const description = `${adjustment.employee.empName} ${adjustmentType} for the month of ${monthName} ${year}`
      await (prisma as any).financialTransaction.create({
        data: {
          transactionType: "Expense",
          transactionDate: adjDate,
          description,
          employeeId: parseInt(employeeId),
          paymentType: "Cash",
          transactionAmount: parseFloat(amount),
        },
      })
    }

    return NextResponse.json(adjustment)
  } catch (error) {
    console.error("Error creating adjustment:", error)
    return NextResponse.json({ error: "Failed to create adjustment" }, { status: 500 })
  }
}

// PUT - Update an adjustment
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (String(currentUser.role || "").toLowerCase() === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { adjustmentId, adjustmentType, amount, adjustmentDate, remarks } = body

    if (!adjustmentId) {
      return NextResponse.json({ error: "adjustmentId is required" }, { status: 400 })
    }

    const updateData: any = {}
    if (adjustmentType) updateData.adjustmentType = adjustmentType
    if (amount) updateData.amount = parseFloat(amount)
    if (adjustmentDate) updateData.adjustmentDate = new Date(adjustmentDate)
    if (remarks !== undefined) updateData.remarks = remarks

    const adjustment = await prisma.adjustment.update({
      where: {
        adjustmentId: parseInt(adjustmentId),
      },
      data: updateData,
      include: {
        employee: {
          select: {
            empName: true,
            idNumber: true,
          },
        },
      },
    })

    return NextResponse.json(adjustment)
  } catch (error) {
    console.error("Error updating adjustment:", error)
    return NextResponse.json({ error: "Failed to update adjustment" }, { status: 500 })
  }
}

// DELETE - Delete an adjustment
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
    const adjustmentId = searchParams.get("adjustmentId")

    if (!adjustmentId) {
      return NextResponse.json({ error: "adjustmentId is required" }, { status: 400 })
    }

    await prisma.adjustment.delete({
      where: {
        adjustmentId: parseInt(adjustmentId),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting adjustment:", error)
    return NextResponse.json({ error: "Failed to delete adjustment" }, { status: 500 })
  }
}
