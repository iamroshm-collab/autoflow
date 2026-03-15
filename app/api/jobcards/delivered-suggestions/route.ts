import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const normalize = (value: string) => value.replace(/[^A-Z0-9]/gi, "").toUpperCase()

const getMatchScore = (text: string, query: string) => {
  if (!query) {
    return 10
  }

  if (text === query) {
    return 0
  }

  if (text.startsWith(query)) {
    return 1
  }

  if (text.includes(query)) {
    return 2
  }

  let qIdx = 0
  let gaps = 0

  for (let i = 0; i < text.length && qIdx < query.length; i++) {
    if (text[i] === query[qIdx]) {
      qIdx++
    } else if (qIdx > 0) {
      gaps++
    }
  }

  if (qIdx === query.length) {
    return 3 + Math.min(gaps, 5)
  }

  return -1
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() || ""
    const normalizedQuery = normalize(q)

    const jobCards = await prisma.jobCard.findMany({
      where: {
        jobcardStatus: "Completed",
        vehicleStatus: "Ready",
      },
      include: {
        customer: {
          select: {
            mobileNo: true,
            name: true,
          },
        },
        vehicle: {
          select: {
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 300,
    })

    const suggestions = jobCards
      .map((jobCard) => {
        const reg = jobCard.vehicle?.registrationNumber || ""
        const normalizedReg = normalize(reg)
        const score = getMatchScore(normalizedReg, normalizedQuery)

        return {
          id: jobCard.id,
          fileNo: jobCard.fileNo || "",
          mobileNo: jobCard.customer?.mobileNo || "",
          registrationNumber: reg,
          customerName: jobCard.customer?.name || "",
          jobCardNumber: jobCard.jobCardNumber,
          vehicleMake: jobCard.vehicle?.make || "",
          vehicleModel: jobCard.vehicle?.model || "",
          score,
          updatedAt: jobCard.updatedAt,
        }
      })
      .filter((item) => (normalizedQuery ? item.score >= 0 : true))
      .sort((a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score
        }
        return +new Date(b.updatedAt) - +new Date(a.updatedAt)
      })
      .slice(0, 12)
      .map(({ updatedAt, score, ...rest }) => rest)

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("[DELIVERED_JOBCARDS_SUGGESTIONS_GET]", error)
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 })
  }
}
