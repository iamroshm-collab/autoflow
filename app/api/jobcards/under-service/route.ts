import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const UNDER_SERVICE_STATUSES = [
  "Under Service",
  "Under service",
  "under service",
  "UNDER SERVICE",
]

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() || ""

    const rows = await prisma.jobCard.findMany({
      where: {
        AND: [
          {
            jobcardStatus: {
              in: UNDER_SERVICE_STATUSES,
            },
          },
          {
            jobcardStatus: {
              not: "Completed",
            },
          },
        ],
        ...(q
          ? {
              OR: [
                { jobCardNumber: { contains: q } },
                { fileNo: { contains: q } },
                { customer: { is: { name: { contains: q } } } },
                { customer: { is: { mobileNo: { contains: q } } } },
                { vehicle: { is: { registrationNumber: { contains: q } } } },
              ],
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            name: true,
            mobileNo: true,
          },
        },
        vehicle: {
          select: {
            make: true,
            model: true,
            registrationNumber: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 150,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[JOBCARDS_UNDER_SERVICE_GET]", error)
    return NextResponse.json({ error: "Failed to fetch under-service jobcards" }, { status: 500 })
  }
}
