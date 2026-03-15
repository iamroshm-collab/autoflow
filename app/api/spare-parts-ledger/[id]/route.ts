import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

const getBillId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  return id?.trim() || null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const billId = await getBillId(params)
    if (!billId) {
      return NextResponse.json({ error: "Invalid bill ID" }, { status: 400 })
    }

    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (Object.prototype.hasOwnProperty.call(body, "shopName")) {
      updateData.shopName = typeof body.shopName === "string" ? body.shopName : ""
    }

    if (Object.prototype.hasOwnProperty.call(body, "billNumber")) {
      updateData.billNumber = typeof body.billNumber === "string" ? body.billNumber : ""
    }

    if (Object.prototype.hasOwnProperty.call(body, "itemDescription")) {
      updateData.itemDescription =
        typeof body.itemDescription === "string" ? body.itemDescription : ""
    }

    if (Object.prototype.hasOwnProperty.call(body, "billDate")) {
      const billDate = body.billDate ? new Date(body.billDate) : null
      if (!billDate || Number.isNaN(billDate.getTime())) {
        return NextResponse.json({ error: "Invalid bill date" }, { status: 400 })
      }
      updateData.billDate = billDate
    }

    if (Object.prototype.hasOwnProperty.call(body, "billReturned")) {
      updateData.billReturned = Boolean(body.billReturned)
    }

    if (Object.prototype.hasOwnProperty.call(body, "returnAmount")) {
      const returnAmount = Number(body.returnAmount)
      if (Number.isNaN(returnAmount) || returnAmount < 0) {
        return NextResponse.json({ error: "Invalid return amount" }, { status: 400 })
      }
      updateData.returnAmount = returnAmount
    }

    if (Object.prototype.hasOwnProperty.call(body, "returnDate")) {
      const returnDate = body.returnDate ? new Date(body.returnDate) : null
      if (returnDate && Number.isNaN(returnDate.getTime())) {
        return NextResponse.json({ error: "Invalid return date" }, { status: 400 })
      }
      updateData.returnedDate = returnDate
    }

    if (Object.prototype.hasOwnProperty.call(body, "paidAmount")) {
      const paidAmount = Number(body.paidAmount)
      if (Number.isNaN(paidAmount) || paidAmount < 0) {
        return NextResponse.json({ error: "Invalid paid amount" }, { status: 400 })
      }
      updateData.paid = paidAmount
    }

    if (Object.prototype.hasOwnProperty.call(body, "paidDate")) {
      const paidDate = body.paidDate ? new Date(body.paidDate) : null
      if (paidDate && Number.isNaN(paidDate.getTime())) {
        return NextResponse.json({ error: "Invalid paid date" }, { status: 400 })
      }
      updateData.paidDate = paidDate
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 })
    }

    const updated = await prismaClient.sparePartsBill.update({
      where: { id: billId },
      data: updateData,
    })

    return NextResponse.json({ success: true, row: updated })
  } catch (error) {
    console.error("[SPARE_PARTS_LEDGER_ID_PATCH]", error)
    return NextResponse.json({ error: "Failed to update spare parts bill" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const billId = await getBillId(params)
    if (!billId) {
      return NextResponse.json({ error: "Invalid bill ID" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const type = body?.type === "payment" ? "payment" : "return"

    const data =
      type === "return"
        ? {
            billReturned: false,
            returnAmount: 0,
            returnedDate: null,
          }
        : {
            paid: 0,
            paidDate: null,
          }

    const updated = await prismaClient.sparePartsBill.update({
      where: { id: billId },
      data,
    })

    return NextResponse.json({ success: true, row: updated })
  } catch (error) {
    console.error("[SPARE_PARTS_LEDGER_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete spare parts sub-record" }, { status: 500 })
  }
}
