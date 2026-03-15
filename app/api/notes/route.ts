import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatDateDDMMYY } from "@/lib/utils"
const VALID_TYPES = new Set(["Credit", "Debit"])

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

const serialize = (row: any) => ({
  id: row.id,
  noteType: row.noteType,
  noteNumber: row.noteNumber,
  date: formatDateDDMMYY(row.noteDate),
  party: row.party,
  reference: row.reference || "",
  amount: Number(row.amount || 0),
  taxRate: Number(row.taxRate || 0),
  reason: row.reason || "",
  gstin: row.gstin || "",
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const noteTypeRaw = searchParams.get("noteType")?.trim() || ""
    const startDateRaw = searchParams.get("startDate")
    const endDateRaw = searchParams.get("endDate")

    const noteType = noteTypeRaw ? (VALID_TYPES.has(noteTypeRaw) ? noteTypeRaw : null) : null
    if (noteTypeRaw && !noteType) {
      return NextResponse.json({ error: "noteType must be Credit or Debit" }, { status: 400 })
    }

    const startDate = parseDate(startDateRaw)
    const endDate = parseDate(endDateRaw)
    if ((startDateRaw && !startDate) || (endDateRaw && !endDate)) {
      return NextResponse.json({ error: "Invalid date filters" }, { status: 400 })
    }

    const dateFilter = startDate || endDate
      ? {
          ...(startDate ? { gte: toStartOfDay(startDate) } : {}),
          ...(endDate ? { lte: toEndOfDay(endDate) } : {}),
        }
      : undefined

    const rows = await prisma.note.findMany({
      where: {
        noteType: noteType || undefined,
        noteDate: dateFilter,
      },
      orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
      take: 1000,
    })

    return NextResponse.json(rows.map(serialize))
  } catch (error) {
    console.error("[NOTES][GET] Failed", error)
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const noteType = typeof body.noteType === "string" ? body.noteType.trim() : ""
    const noteNumber = typeof body.noteNumber === "string" ? body.noteNumber.trim() : ""
    const party = typeof body.party === "string" ? body.party.trim() : ""
    const reference = typeof body.reference === "string" ? body.reference.trim() : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""
    const gstin = typeof body.gstin === "string" ? body.gstin.trim() : ""
    const amount = Number(body.amount || 0)
    const taxRate = Number(body.taxRate || 0)
    const noteDateParsed = parseDate(body.date)

    if (!VALID_TYPES.has(noteType)) {
      return NextResponse.json({ error: "noteType must be Credit or Debit" }, { status: 400 })
    }
    if (!noteNumber) {
      return NextResponse.json({ error: "noteNumber is required" }, { status: 400 })
    }
    if (!party) {
      return NextResponse.json({ error: "party is required" }, { status: 400 })
    }
    if (!noteDateParsed) {
      return NextResponse.json({ error: "date is invalid" }, { status: 400 })
    }
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 })
    }
    if (Number.isNaN(taxRate) || taxRate < 0) {
      return NextResponse.json({ error: "taxRate must be a positive number" }, { status: 400 })
    }

    const created = await prisma.note.create({
      data: {
        noteType,
        noteNumber,
        noteDate: toStartOfDay(noteDateParsed),
        party,
        reference: reference || null,
        amount,
        taxRate,
        reason: reason || null,
        gstin: gstin || null,
      },
    })

    return NextResponse.json(serialize(created), { status: 201 })
  } catch (error: any) {
    console.error("[NOTES][POST] Failed", error)
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Note number already exists for this type" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}
