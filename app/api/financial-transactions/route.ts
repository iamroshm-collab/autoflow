import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VALID_TRANSACTION_TYPES = new Set(["Income", "Expense"])
const VALID_PAYMENT_TYPES = new Set(["Cash", "Bank Transfer", "UPI"])

const parseDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const toStartOfDay = (value: Date) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const toEndOfDay = (value: Date) => {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

const toAmount = (value: unknown) => {
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeTransactionType = (value: unknown): "Income" | "Expense" | null => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "income") return "Income"
  if (normalized === "expense") return "Expense"
  return null
}

const classifyTransactionType = (value: unknown, amount: number): "Income" | "Expense" => {
  const normalizedType = normalizeTransactionType(value)
  if (normalizedType) return normalizedType
  return amount < 0 ? "Expense" : "Income"
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const startDateRaw = searchParams.get("startDate")
    const endDateRaw = searchParams.get("endDate")
    const transactionTypeRaw = searchParams.get("transactionType")?.trim() || ""
    const employeeIdRaw = searchParams.get("employeeId")
    const includePayroll = searchParams.get("includePayroll") === "true"
    const jobCardId = searchParams.get("jobCardId")?.trim() || ""

    const startDate = parseDate(startDateRaw)
    const endDate = parseDate(endDateRaw)

    if ((startDateRaw && !startDate) || (endDateRaw && !endDate)) {
      return NextResponse.json({ error: "Invalid date filters" }, { status: 400 })
    }

    const transactionType = normalizeTransactionType(transactionTypeRaw) || ""

    const employeeId = employeeIdRaw ? Number(employeeIdRaw) : undefined
    if (employeeIdRaw && !Number.isInteger(employeeId)) {
      return NextResponse.json({ error: "Invalid employee filter" }, { status: 400 })
    }

    const dateFilter =
      startDate || endDate
        ? {
            ...(startDate ? { gte: toStartOfDay(startDate) } : {}),
            ...(endDate ? { lte: toEndOfDay(endDate) } : {}),
          }
        : undefined

    if (jobCardId) {
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          jobCardId,
        },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      })

      const rows = transactions.map((row) => ({
        id: String(row.id),
        transactionType: classifyTransactionType(row.transactionType, toAmount(row.transactionAmount)),
        transactionDate: row.transactionDate,
        description: row.description,
        paymentType: row.paymentType,
        transactionAmount: Number(row.transactionAmount || 0),
        vehicleId: row.vehicleId,
        jobCardId: row.jobCardId,
      }))

      return NextResponse.json({ rows })
    }

    const transactions = await prisma.financialTransaction.findMany({
      where: {
        transactionDate: dateFilter,
        employeeId: Number.isInteger(employeeId) ? employeeId : undefined,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
        employee: {
          select: {
            employeeId: true,
            empName: true,
            mobile: true,
          },
        },
      },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: 1000, // Limit to prevent memory issues
    })

    const manualRows = transactions
      .map((row) => {
        const amount = toAmount(row.transactionAmount)
        const normalizedType = classifyTransactionType(row.transactionType, amount)

        return {
        id: String(row.id),
        source: "ledger" as const,
        transactionType: normalizedType,
        transactionDate: row.transactionDate,
        description: row.description,
        vehicle: row.vehicle
          ? {
              id: row.vehicle.id,
              registrationNumber: row.vehicle.registrationNumber,
              make: row.vehicle.make,
              model: row.vehicle.model,
            }
          : null,
        employee: row.employee
          ? {
              employeeId: row.employee.employeeId,
              empName: row.employee.empName,
              mobile: row.employee.mobile,
            }
          : null,
        paymentType: row.paymentType,
        transactionAmount: amount,
        recordTime: row.recordTime,
        payrollTag: null as string | null,
      }
      })
      .filter((row) => (transactionType ? row.transactionType === transactionType : true))

    let payrollRows: Array<{
      id: string
      source: "payroll"
      transactionType: "Income" | "Expense"
      transactionDate: Date
      description: string
      vehicle: null
      employee: {
        employeeId: number
        empName: string
        mobile: string
      } | null
      paymentType: string
      transactionAmount: number
      recordTime: Date
      payrollTag: string
    }> = []

    if (includePayroll) {
      const payrollRecords = await prisma.attendancePayroll.findMany({
        where: {
          attendanceDate: dateFilter,
          employeeId: Number.isInteger(employeeId) ? employeeId : undefined,
          OR: [{ incentive: { gt: 0 } }, { salaryAdvance: { gt: 0 } }],
        },
        include: {
          employee: {
            select: {
              employeeId: true,
              empName: true,
              mobile: true,
            },
          },
        },
        orderBy: [{ attendanceDate: "desc" }, { attendanceId: "desc" }],
        take: 500,
      })

      payrollRows = payrollRecords.flatMap((row) => {
        const employeeLabel = row.employee?.empName || `Employee ${row.employeeId}`
        const paymentType = row.paymentType?.trim() || "Cash"
        const normalizedPaymentType = VALID_PAYMENT_TYPES.has(paymentType)
          ? paymentType
          : "Cash"

        const rowsForEntry: typeof payrollRows = []

        if (Number(row.incentive || 0) > 0) {
          rowsForEntry.push({
            id: `payroll-incentive-${row.attendanceId}`,
            source: "payroll",
            transactionType: "Income",
            transactionDate: row.attendanceDate,
            description: `Employee Incentive - ${employeeLabel}`,
            vehicle: null,
            employee: row.employee
              ? {
                  employeeId: row.employee.employeeId,
                  empName: row.employee.empName,
                  mobile: row.employee.mobile,
                }
              : null,
            paymentType: normalizedPaymentType,
            transactionAmount: Number(row.incentive || 0),
            recordTime: row.updatedAt,
            payrollTag: "Payroll Incentive",
          })
        }

        if (Number(row.salaryAdvance || 0) > 0) {
          rowsForEntry.push({
            id: `payroll-advance-${row.attendanceId}`,
            source: "payroll",
            transactionType: "Expense",
            transactionDate: row.attendanceDate,
            description: `Salary Advance - ${employeeLabel}`,
            vehicle: null,
            employee: row.employee
              ? {
                  employeeId: row.employee.employeeId,
                  empName: row.employee.empName,
                  mobile: row.employee.mobile,
                }
              : null,
            paymentType: normalizedPaymentType,
            transactionAmount: Number(row.salaryAdvance || 0),
            recordTime: row.updatedAt,
            payrollTag: "Salary Advance",
          })
        }

        return rowsForEntry
      })

      if (transactionType) {
        payrollRows = payrollRows.filter((row) => row.transactionType === transactionType)
      }
    }

    const rows = [...manualRows, ...payrollRows].sort(
      (a, b) => +new Date(b.transactionDate) - +new Date(a.transactionDate)
    )

    const totals = rows.reduce(
      (acc, row) => {
        const amount = toAmount(row.transactionAmount)
        if (row.transactionType === "Income") {
          acc.totalIncome += amount
        } else if (row.transactionType === "Expense") {
          acc.totalExpense += amount
        }
        return acc
      },
      { totalIncome: 0, totalExpense: 0 }
    )

    return NextResponse.json({
      rows,
      totals: {
        totalIncome: totals.totalIncome,
        totalExpense: totals.totalExpense,
        netProfitLoss: totals.totalIncome - totals.totalExpense,
      },
    })
  } catch (error) {
    console.error("[FINANCIAL_TRANSACTIONS_GET]", error)
    return NextResponse.json({ error: "Failed to fetch financial transactions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const transactionType = normalizeTransactionType(body.transactionType)
    const description = String(body.description || "").trim()
    const paymentType = String(body.paymentType || "").trim()
    const transactionAmount = Number(body.transactionAmount || 0)
    const transactionDate = parseDate(body.transactionDate)
    const vehicleId = String(body.vehicleId || "").trim() || null
    const jobCardId = String(body.jobCardId || "").trim() || null
    const customerName = String(body.customerName || "").trim() || null
    const mobileNumber = String(body.mobileNumber || "").trim() || null
    const vehicleMake = String(body.vehicleMake || "").trim() || null
    const employeeIdRaw = body.employeeId
    const employeeId =
      employeeIdRaw === null || employeeIdRaw === undefined || employeeIdRaw === ""
        ? null
        : Number(employeeIdRaw)

    if (!transactionType || !VALID_TRANSACTION_TYPES.has(transactionType)) {
      return NextResponse.json({ error: "Transaction type is required" }, { status: 400 })
    }

    if (!transactionDate) {
      return NextResponse.json({ error: "Transaction date is required" }, { status: 400 })
    }

    if (!VALID_PAYMENT_TYPES.has(paymentType)) {
      return NextResponse.json({ error: "Invalid payment type" }, { status: 400 })
    }

    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      return NextResponse.json({ error: "Transaction amount must be greater than zero" }, { status: 400 })
    }

    if (employeeId !== null && !Number.isInteger(employeeId)) {
      return NextResponse.json({ error: "Invalid employee" }, { status: 400 })
    }

    const created = await prisma.financialTransaction.create({
      data: {
        transactionType,
        transactionDate,
        description,
        vehicleId,
        jobCardId,
        employeeId,
        paymentType,
        transactionAmount,
        customerName,
        mobileNumber,
        vehicleMake,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
        employee: {
          select: {
            employeeId: true,
            empName: true,
            mobile: true,
          },
        },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("[FINANCIAL_TRANSACTIONS_POST]", error)
    return NextResponse.json({ error: "Failed to create financial transaction" }, { status: 500 })
  }
}
