import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(_request: NextRequest) {
  try {
    // Fetch delivered jobcards with complete data
    const jobcards = await prisma.jobCard.findMany({
      where: {
        OR: [
          { vehicleStatus: { in: ["Delivered", "delivered", "DELIVERED"] } },
          { jobcardStatus: { in: ["Delivered", "delivered", "DELIVERED"] } },
        ],
      },
      select: {
        id: true,
        deliveryDate: true,
        jobCardNumber: true,
        maintenanceType: true,
        kmDriven: true,
        vehicleStatus: true,
        jobcardPaymentStatus: true,
        customer: {
          select: {
            id: true,
            name: true,
            mobileNo: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
          },
        },
        serviceDescriptions: {
          orderBy: { sl: "asc" },
          select: {
            id: true,
            description: true,
            sl: true,
          },
        },
        sparePartsBills: {
          orderBy: { billDate: "desc" },
          select: {
            id: true,
            shopName: true,
            billNumber: true,
            itemDescription: true,
            amount: true,
            billDate: true,
          },
        },
        employeeEarnings: {
          select: {
            id: true,
            employee: true,
            workType: true,
            amount: true,
          },
        },
      },
      orderBy: {
        deliveryDate: "desc",
      },
      take: 500,
    })

    return NextResponse.json(jobcards)
  } catch (error) {
    console.error("[MAINTENANCE_TRACKER_GET]", error)
    return NextResponse.json({ error: "Failed to fetch maintenance data" }, { status: 500 })
  }
}
