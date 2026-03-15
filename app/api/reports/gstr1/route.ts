import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function buildDateRange(searchParams: URLSearchParams) {
  const start = searchParams.get("startDate")
  const end = searchParams.get("endDate")
  const range: { gte?: Date; lte?: Date } = {}

  if (start) {
    const d = new Date(start)
    if (!Number.isNaN(d.getTime())) range.gte = d
  }

  if (end) {
    const d = new Date(end)
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999)
      range.lte = d
    }
  }

  return range
}

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams
    const dateRange = buildDateRange(searchParams)
    const saleDateFilter = Object.keys(dateRange).length ? { billDate: dateRange } : {}
    const creditDateFilter = Object.keys(dateRange).length ? { creditNoteDate: dateRange } : {}

    const b2bInvoices = await prisma.sale.findMany({
      where: { invoiceType: "B2B", ...saleDateFilter },
      select: {
        saleId: true,
        billNumber: true,
        billDate: true,
        customer: true,
        customerGstin: true,
        placeOfSupplyStateCode: true,
        totalTaxableAmount: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        grandTotal: true,
      },
      orderBy: { billDate: "asc" },
    })

    const b2cLarge = await prisma.sale.findMany({
      where: {
        invoiceType: "B2C",
        grandTotal: { gt: 250000 },
        ...saleDateFilter,
      },
      select: {
        saleId: true,
        billNumber: true,
        billDate: true,
        placeOfSupplyStateCode: true,
        totalTaxableAmount: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        grandTotal: true,
      },
      orderBy: { billDate: "asc" },
    })

    const b2cSmall = await prisma.sale.groupBy({
      by: ["placeOfSupplyStateCode"],
      where: {
        invoiceType: "B2C",
        grandTotal: { lte: 250000 },
        ...saleDateFilter,
      },
      _sum: {
        totalTaxableAmount: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        grandTotal: true,
      },
    })

    const salesAgg = await prisma.sale.aggregate({
      where: saleDateFilter,
      _sum: {
        totalTaxableAmount: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        grandTotal: true,
      },
    })

    const creditAgg = await prisma.creditNoteHeader.aggregate({
      where: creditDateFilter,
      _sum: {
        totalTaxableAmount: true,
        totalCgst: true,
        totalSgst: true,
        totalIgst: true,
        grandTotal: true,
      },
    })

    const taxLiability = {
      taxable: Number(salesAgg._sum.totalTaxableAmount || 0) - Number(creditAgg._sum.totalTaxableAmount || 0),
      cgst: Number(salesAgg._sum.totalCgst || 0) - Number(creditAgg._sum.totalCgst || 0),
      sgst: Number(salesAgg._sum.totalSgst || 0) - Number(creditAgg._sum.totalSgst || 0),
      igst: Number(salesAgg._sum.totalIgst || 0) - Number(creditAgg._sum.totalIgst || 0),
      gross: Number(salesAgg._sum.grandTotal || 0) - Number(creditAgg._sum.grandTotal || 0),
    }

    return NextResponse.json({ b2bInvoices, b2cLarge, b2cSmall, taxLiability })
  } catch (error) {
    console.error("[GSTR1_REPORT]", error)
    return NextResponse.json({ error: "Failed to generate GSTR-1 report" }, { status: 500 })
  }
}
