import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const allowed = [
      "description",
      "unit",
      "quantity",
      "amount",
      "cgstRate",
      "sgstRate",
      "igstRate",
      "stateId",
    ]

    const data: any = {}
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        data[key] = body[key]
      }
    }

    // normalize numeric fields
    const amount = Number(data.amount ?? body.amount ?? 0)
    const cgstRate = Number(data.cgstRate ?? body.cgstRate ?? 0)
    const sgstRate = Number(data.sgstRate ?? body.sgstRate ?? 0)
    const igstRate = Number(data.igstRate ?? body.igstRate ?? 0)

    const cgstAmount = parseFloat(((amount * cgstRate) / 100).toFixed(2))
    const sgstAmount = parseFloat(((amount * sgstRate) / 100).toFixed(2))
    const igstAmount = parseFloat(((amount * igstRate) / 100).toFixed(2))

    const totalAmount = igstRate > 0
      ? parseFloat((amount + igstAmount).toFixed(2))
      : parseFloat((amount + cgstAmount + sgstAmount).toFixed(2))

    data.amount = amount
    data.cgstRate = cgstRate
    data.sgstRate = sgstRate
    data.igstRate = igstRate
    data.cgstAmount = cgstAmount
    data.sgstAmount = sgstAmount
    data.igstAmount = igstAmount
    data.totalAmount = totalAmount

    const updated = await prisma.serviceDescription.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[SERVICE_DESCRIPTION_PATCH]", error)
    return NextResponse.json({ error: "Failed to update service description" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rec = await prisma.serviceDescription.findUnique({ where: { id } })
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(rec)
  } catch (error) {
    console.error("[SERVICE_DESCRIPTION_GET]", error)
    return NextResponse.json({ error: "Failed to fetch service description" }, { status: 500 })
  }
}
