import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const vehicleId = request.nextUrl.searchParams.get("vehicleId")?.trim() || ""

    if (!vehicleId) {
      return NextResponse.json({ error: "vehicleId is required" }, { status: 400 })
    }

    const activeJobCard = await prisma.jobCard.findFirst({
      where: {
        vehicleId,
        jobcardStatus: {
          in: ["Under Service", "Under service", "under service", "UNDER SERVICE"],
        },
      },
      select: {
        id: true,
        jobCardNumber: true,
        jobcardStatus: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    if (!activeJobCard) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      jobCard: activeJobCard,
    })
  } catch (error) {
    console.error("[JOBCARDS_ACTIVE_GET]", error)
    return NextResponse.json(
      { error: "Failed to check active jobcard" },
      { status: 500 }
    )
  }
}
