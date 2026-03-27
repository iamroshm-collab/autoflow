import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const externalShopJobs = await prisma.jobCard.findMany({
      where: {
        externalShop: true,
      },
      include: {
        customer: true,
        vehicle: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    })

    const formattedJobs = externalShopJobs.map((job) => ({
      id: job.id,
      jobCardNumber: job.jobCardNumber,
      customerName: job.customer?.name || "",
      mobileNo: job.customer?.mobileNo || "",
      vehicleReg: job.vehicle?.registrationNumber || "",
      vehicleMake: job.vehicle?.make || "",
      vehicleModel: job.vehicle?.model || "",
      remarks: job.externalShopRemarks || "",
    }))

    return NextResponse.json(formattedJobs)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[EXTERNAL_SHOP_GET] Error:", errorMessage)
    console.error("[EXTERNAL_SHOP_GET] Full error:", error)
    return NextResponse.json(
      { error: "Failed to fetch external shop jobs", details: errorMessage }, 
      { status: 500 }
    )
  }
}
