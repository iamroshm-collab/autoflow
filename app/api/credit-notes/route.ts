import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const saleIdParam = request.nextUrl.searchParams.get("saleId")
    const saleId = saleIdParam ? Number(saleIdParam) : undefined

    const notes = await prisma.creditNoteHeader.findMany({
      where: saleId ? { salesId: saleId } : undefined,
      include: {
        details: true,
        branch: true,
      },
      orderBy: { creditNoteDate: "desc" },
      take: 100,
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error("[CREDIT_NOTE_GET]", error)
    return NextResponse.json({ error: "Failed to fetch credit notes" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const saleId = Number(body.saleId)
    const reason = body.reason || null
    const details = Array.isArray(body.details) ? body.details : []

    if (!Number.isInteger(saleId)) {
      return NextResponse.json({ error: "saleId is required" }, { status: 400 })
    }
    if (details.length === 0) {
      return NextResponse.json({ error: "At least one detail row is required" }, { status: 400 })
    }

    const created = await prisma.$transaction(async (tx: any) => {
      const sale = await tx.sale.findUnique({
        where: { saleId },
        include: { saleDetails: true, branch: true },
      })
      if (!sale) {
        throw new Error("Sale not found")
      }
      const branchId = sale.branchId || (await tx.branch.findFirst({ select: { id: true } }))?.id
      if (!branchId) {
        throw new Error("Branch is required for credit notes")
      }

      let totalTaxableAmount = 0
      let totalCgst = 0
      let totalSgst = 0
      let totalIgst = 0
      let grandTotal = 0

      const header = await tx.creditNoteHeader.create({
        data: {
          salesId: sale.saleId,
          branchId,
          creditNoteNumber: body.creditNoteNumber || `CN-${Date.now()}`,
          creditNoteDate: body.creditNoteDate ? new Date(body.creditNoteDate) : new Date(),
          reason,
        },
      })

      for (const item of details) {
        const saleDetailsId = Number(item.saleDetailsId)
        const quantity = Number(item.quantity || item.returnQnty || 0)
        if (!Number.isInteger(saleDetailsId) || quantity <= 0) {
          throw new Error("Invalid saleDetailsId or quantity")
        }

        const saleDetail = sale.saleDetails.find((d: any) => d.saleDetailsId === saleDetailsId)
        if (!saleDetail) {
          throw new Error(`Sale detail ${saleDetailsId} not found`)
        }
        if (quantity > Number(saleDetail.qnty || 0)) {
          throw new Error(`Return quantity exceeds sold quantity for detail ${saleDetailsId}`)
        }

        const ratio = quantity / Number(saleDetail.qnty || 1)
        const taxableValue = ratio * Number(saleDetail.taxableValue || 0)
        const cgstAmount = ratio * Number(saleDetail.cgstAmount || 0)
        const sgstAmount = ratio * Number(saleDetail.sgstAmount || 0)
        const igstAmount = ratio * Number(saleDetail.igstAmount || 0)
        const lineTotal = taxableValue + cgstAmount + sgstAmount + igstAmount

        await tx.creditNoteDetail.create({
          data: {
            creditNoteId: header.id,
            saleDetailsId,
            productId: saleDetail.productId,
            hsnCode: saleDetail.hsn,
            gstPercent: saleDetail.gstPercent || 0,
            taxableValue,
            cgstAmount,
            sgstAmount,
            igstAmount,
            quantity,
          },
        })

        totalTaxableAmount += taxableValue
        totalCgst += cgstAmount
        totalSgst += sgstAmount
        totalIgst += igstAmount
        grandTotal += lineTotal
      }

      await tx.creditNoteHeader.update({
        where: { id: header.id },
        data: {
          totalTaxableAmount,
          totalCgst,
          totalSgst,
          totalIgst,
          grandTotal,
        },
      })

      return tx.creditNoteHeader.findUnique({
        where: { id: header.id },
        include: { details: true },
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("[CREDIT_NOTE_POST]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create credit note" }, { status: 500 })
  }
}
