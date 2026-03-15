import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const LEDGER_JOB_CARD_NUMBER = "SPARE_LEDGER"

const generatePlaceholderCustomerMobile = () => {
  const timestamp = Date.now().toString()
  return `900${timestamp.slice(-7).padStart(7, "0")}`
}

const ensureLedgerJobCard = async () => {
  const existing = await prisma.jobCard.findUnique({ where: { jobCardNumber: LEDGER_JOB_CARD_NUMBER } })

  if (existing) {
    return existing
  }

  const customer = await prisma.customer.create({
    data: {
      name: "Ledger Placeholder",
      mobileNo: generatePlaceholderCustomerMobile(),
    },
  })

  const vehicle = await prisma.vehicle.create({
    data: {
      registrationNumber: `LEDGER-${Date.now()}`,
      make: "Ledger",
      model: "Placeholder",
    },
  })

  return prisma.jobCard.create({
    data: {
      jobCardNumber: LEDGER_JOB_CARD_NUMBER,
      serviceDate: new Date(),
      customerId: customer.id,
      vehicleId: vehicle.id,
      total: 0,
      paidAmount: 0,
      advancePayment: 0,
      discount: 0,
      jobcardStatus: "Under Service",
      jobcardPaymentStatus: "Pending",
      taxable: false,
    },
  })
}

export async function GET() {
  try {
    const [spareRows, sparePartShops] = await Promise.all([
      prisma.sparePartsBill.findMany({
        select: {
          id: true,
          shopName: true,
          billDate: true,
          billNumber: true,
          itemDescription: true,
          amount: true,
          billReturned: true,
          returnedDate: true,
          returnAmount: true,
          paid: true,
          paidDate: true,
        },
        orderBy: [{ createdAt: "desc" }, { billDate: "desc" }],
        take: 1000, // Limit to last 1000 records
      }),
      prisma.sparePartShop.findMany({
        select: {
          shopName: true,
        },
        orderBy: {
          shopName: "asc",
        },
      }),
    ])

    const shopOptions = Array.from(
      new Set(sparePartShops.map((item) => item.shopName.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))

    const rows = spareRows.map((row: any) => ({
      id: row.id,
      shopName: row.shopName,
      billDate: row.billDate,
      billNumber: row.billNumber,
      item: row.itemDescription || "",
      amount: Number(row.amount || 0),
      return: Boolean(row.billReturned),
      returnDate: row.returnedDate,
      returnAmount: Number(row.returnAmount || 0),
      paidAmount: Number(row.paid || 0),
      paidDate: row.paidDate,
    }))

    return NextResponse.json({
      rows,
      shopOptions,
    })
  } catch (error) {
    console.error("[SPARE_PARTS_LEDGER_GET]", error)
    return NextResponse.json({ error: "Failed to fetch spare parts ledger" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: string
      shopName?: string
      billDate?: string
      billNumber?: string
      item?: string
      itemDescription?: string
      amount?: number | string
      returnAmount?: number | string
      returnDate?: string | null
      paidAmount?: number | string
      paidDate?: string | null
    }

    const { type } = body
    const recordType = type === "payment" ? "payment" : "return"

    const parseAmount = (value: number | string | undefined, label: string) => {
      const parsed = Number(value ?? 0)
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(`Invalid ${label}`)
      }
      return parsed
    }

    const billDate = body.billDate ? new Date(body.billDate) : new Date()
    if (Number.isNaN(billDate.getTime())) {
      return NextResponse.json({ error: "Invalid bill date" }, { status: 400 })
    }

    const returnDate = body.returnDate ? new Date(body.returnDate) : null
    if (returnDate && Number.isNaN(returnDate.getTime())) {
      return NextResponse.json({ error: "Invalid return date" }, { status: 400 })
    }

    const paidDate = body.paidDate ? new Date(body.paidDate) : null
    if (paidDate && Number.isNaN(paidDate.getTime())) {
      return NextResponse.json({ error: "Invalid paid date" }, { status: 400 })
    }

    const jobCard = await ensureLedgerJobCard()
    const lastEntry = await prisma.sparePartsBill.findFirst({
      where: { jobCardId: jobCard.id },
      orderBy: { sl: "desc" },
      select: { sl: true },
    })

    const nextSl = (lastEntry?.sl || 0) + 1
    const now = new Date()
    const amount = parseAmount(body.amount, "amount")
    const returnAmount = parseAmount(body.returnAmount, "return amount")
    const paidAmount = parseAmount(body.paidAmount, "paid amount")
    const shopName = (body.shopName || "").trim()
    const billNumber = (body.billNumber || `LEDGER-${nextSl}`).trim()
    const itemDescription = (body.itemDescription || body.item || "").trim()

    const created = await prisma.sparePartsBill.create({
      data: {
        sl: nextSl,
        jobCardId: jobCard.id,
        shopName,
        address: null,
        vehicleMake: "Ledger",
        vehicleModel: "Placeholder",
        registrationNumber: `LEDGER-${now.getTime()}`,
        billDate,
        billNumber,
        amount,
        paid: paidAmount,
        itemDescription,
        billReturned: recordType === "return" || returnAmount > 0 || Boolean(returnDate),
        returnAmount,
        returnedDate: returnDate ?? (recordType === "return" ? now : null),
        paidDate: paidDate ?? (recordType === "payment" ? now : null),
      },
    })

    return NextResponse.json({ success: true, row: created })
  } catch (error) {
    console.error("[SPARE_PARTS_LEDGER_POST]", error)
    return NextResponse.json({ error: "Failed to create ledger row" }, { status: 500 })
  }
}
