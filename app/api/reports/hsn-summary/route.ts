import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const hsnSummary = await prisma.saleDetail.groupBy({
      by: ["hsn"],
      _sum: {
        qnty: true,
        taxableValue: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        totalAmount: true,
      },
    })

    return NextResponse.json({ hsnSummary })
  } catch (error) {
    console.error("[HSN_SUMMARY]", error)
    return NextResponse.json({ error: "Failed to generate HSN summary" }, { status: 500 })
  }
}
