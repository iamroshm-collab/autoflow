import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const validTypes = ["electrical", "ac", "mechanical", "others"] as const

const toDbWorkType = (type: string) => {
  if (type === "ac") return "AC"
  if (type === "electrical") return "Electrical"
  if (type === "mechanical") return "Mechanical"
  if (type === "others") return "Others"
  return ""
}

export async function GET(request: NextRequest) {
  try {
    const workTypeRaw = request.nextUrl.searchParams.get("type")?.trim().toLowerCase() || ""

    if (!workTypeRaw || !validTypes.includes(workTypeRaw as any)) {
      return NextResponse.json(
        { error: "Valid type is required: electrical | ac | mechanical | others" },
        { status: 400 }
      )
    }

    const workTypeDb = toDbWorkType(workTypeRaw)

    const jobCards = await prisma.jobCard.findMany({
      where: {
        employeeEarnings: {
          some: {
            workType: {
              equals: workTypeDb,
              mode: 'insensitive'
            }
          }
        }
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
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
        employeeEarnings: {
          where: {
            workType: {
              equals: workTypeDb,
              mode: 'insensitive'
            }
          },
          orderBy: {
            sl: "asc",
          },
          select: {
            employee: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 500, // Limit to 500 recent job cards
    })

    const result = jobCards.map((jobCard) => {
        return {
          jobCardId: jobCard.id,
          jobCardNumber: jobCard.jobCardNumber,
          registrationNumber: jobCard.vehicle.registrationNumber,
          vehicleModel: `${jobCard.vehicle.make} ${jobCard.vehicle.model}`.trim(),
          customerName: jobCard.customer.name,
          customerMobileNo: jobCard.customer.mobileNo,
          technicians: Array.from(
            new Set(
              jobCard.employeeEarnings
                .map((tech) => tech.employee)
                .filter((name): name is string => Boolean(name && name.trim()))
            )
          ),
          jobcardStatus: jobCard.jobcardStatus,
          serviceDate: jobCard.serviceDate,
          deliveryStatus: jobCard.vehicleStatus,
        }
      })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[JOBCARDS_WORK_SUMMARY_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch work summary" },
      { status: 500 }
    )
  }
}
