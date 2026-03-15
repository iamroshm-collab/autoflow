import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      jobCardNumber,
      shopCode,
      customerId,
      vehicleId,
      serviceDate,
      fileNo,
      kmDriven,
      total,
      paidAmount,
      jobcardStatus,
    } = body

    if (!jobCardNumber || !customerId || !vehicleId || !serviceDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const parsedServiceDate = new Date(serviceDate)
    if (Number.isNaN(parsedServiceDate.getTime())) {
      return NextResponse.json({ error: "Invalid service date" }, { status: 400 })
    }

    // Use a transaction to create jobcard and update vehicle.lastCustomerId atomically
    const result = await prisma.$transaction(async (tx) => {
      const jobCard = await tx.jobCard.create({
        data: {
          jobCardNumber,
          shopCode: shopCode || "AL",
          customerId,
          vehicleId,
          serviceDate: parsedServiceDate,
          fileNo: fileNo || null,
          kmDriven: kmDriven ? parseInt(kmDriven) : null,
          total: total ? Number(total) : 0,
          paidAmount: paidAmount ? Number(paidAmount) : 0,
          jobcardStatus: jobcardStatus || "Under Service",
        },
        include: { customer: true, vehicle: true },
      })

      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { lastCustomerId: customerId },
      })

      return jobCard
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("[JOBCARD_TRANSACTION_POST]", error)

    // Handle unique constraint
    if (typeof error === "object" && error !== null && "code" in error && (error as any).code === "P2002") {
      return NextResponse.json({ error: "Unique constraint failed" }, { status: 409 })
    }

    return NextResponse.json({ error: "Failed to create jobcard" }, { status: 500 })
  }
}
