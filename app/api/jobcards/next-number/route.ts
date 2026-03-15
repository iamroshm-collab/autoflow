import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const shopCode = searchParams.get("shopCode") || "AL"
    const year = searchParams.get("year") || new Date().getFullYear()

    // Find the last jobcard for this shop and year
    const lastJobCard = await prisma.jobCard.findFirst({
      where: {
        shopCode,
        jobCardNumber: {
          startsWith: `JC-${shopCode}-${year}-`,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    let sequence = 1
    if (lastJobCard) {
      const parts = lastJobCard.jobCardNumber.split("-")
      const lastSequence = parseInt(parts[3] || "0")
      sequence = lastSequence + 1
    }

    const paddedSequence = sequence.toString().padStart(4, "0")
    const jobCardNumber = `JC-${shopCode}-${year}-${paddedSequence}`

    return NextResponse.json({ jobCardNumber, sequence })
  } catch (error) {
    console.error("[JOBCARD_NUMBER_GET]", error)
    return NextResponse.json(
      { error: "Failed to generate jobcard number" },
      { status: 500 }
    )
  }
}
