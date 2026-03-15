import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VALID_TRANSACTION_TYPES = new Set(["Income", "Expense"])
const VALID_PAYMENT_TYPES = new Set(["Cash", "Bank Transfer", "UPI"])

const normalizeTransactionType = (value: unknown): "Income" | "Expense" | null => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "income") return "Income"
  if (normalized === "expense") return "Expense"
  return null
}

const parseDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const parseId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  const parsed = Number(id)
  return Number.isInteger(parsed) ? parsed : null
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsedId = await parseId(params)
    if (parsedId === null) {
      return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 })
    }
    const id = parsedId

    const body = await request.json()

    const transactionType = normalizeTransactionType(body.transactionType)
    const description = String(body.description || "").trim()
    const paymentType = String(body.paymentType || "").trim()
    const transactionAmount = Number(body.transactionAmount || 0)
    const transactionDate = parseDate(body.transactionDate)
    const vehicleId = String(body.vehicleId || "").trim() || null
    const jobCardId = String(body.jobCardId || "").trim() || null
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

    const updated = await prisma.financialTransaction.update({
      where: { id },
      data: {
        transactionType,
        transactionDate,
        description,
        vehicleId,
        jobCardId,
        employeeId,
        paymentType,
        transactionAmount,
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[FINANCIAL_TRANSACTIONS_PUT]", error)
    return NextResponse.json({ error: "Failed to update financial transaction" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsedId = await parseId(params)
    if (parsedId === null) {
      return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 })
    }
    const id = parsedId

    await prisma.financialTransaction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[FINANCIAL_TRANSACTIONS_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete financial transaction" }, { status: 500 })
  }
}
