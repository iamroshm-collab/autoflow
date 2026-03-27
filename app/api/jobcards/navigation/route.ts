import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jobcardStatus = searchParams.get("jobcardStatus")?.trim() || ""
    const registrationNumber = searchParams.get("registrationNumber")?.trim().toUpperCase() || ""
    const excludeVehicleStatus = searchParams.get("excludeVehicleStatus")?.trim() || ""

    const whereConditions: any[] = []

    if (jobcardStatus) {
      whereConditions.push({ jobcardStatus })
    }

    if (registrationNumber) {
      whereConditions.push({
        vehicle: {
          is: {
            registrationNumber,
          },
        },
      })
    }

    // Apply exclusion filter after fetching to handle case-insensitive comparison
    let records = await prisma.jobCard.findMany({
      where: whereConditions.length > 0 ? { AND: whereConditions } : {},
      select: {
        id: true,
        jobCardNumber: true,
        vehicleStatus: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 2000,
    })

    // Filter out records with excluded vehicle status (case-insensitive)
    if (excludeVehicleStatus) {
      records = records.filter(
        (record) =>
          !record.vehicleStatus ||
          record.vehicleStatus.toLowerCase() !== excludeVehicleStatus.toLowerCase()
      )
    }

    // Remove the vehicleStatus field before returning
    const cleanedRecords = records.map(({ vehicleStatus, ...record }) => record)

    return NextResponse.json(cleanedRecords)
  } catch (error) {
    console.error("[JOBCARDS_NAVIGATION_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch jobcard navigation records" },
      { status: 500 }
    )
  }
}
