import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createRoleNotifications } from "@/lib/app-notifications"

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
      jobcardStatus,
    } = body

    // Validate required fields
    if (!jobCardNumber || !customerId || !vehicleId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const parsedServiceDate = new Date(serviceDate)
    if (Number.isNaN(parsedServiceDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid service date" },
        { status: 400 }
      )
    }

    const existingByJobCardNumber = await prisma.jobCard.findUnique({
      where: { jobCardNumber },
      select: { id: true },
    })

    if (existingByJobCardNumber) {
      return NextResponse.json(
        { error: "JobCard number already exists" },
        { status: 409 }
      )
    }

    const existingUnderServiceForVehicle = await prisma.jobCard.findFirst({
      where: {
        vehicleId,
        jobcardStatus: {
          in: ["Under Service", "Under service", "under service", "UNDER SERVICE"],
        },
      },
      select: { id: true, jobCardNumber: true },
    })

    if (existingUnderServiceForVehicle) {
      return NextResponse.json(
        {
          code: "ACTIVE_JOBCARD_EXISTS",
          error:
            "This vehicle already has an active JobCard with status Under Service",
        },
        { status: 409 }
      )
    }

    // Create jobcard
    const jobCard = await prisma.jobCard.create({
      data: {
        jobCardNumber,
        shopCode: shopCode || "AL",
        customerId,
        vehicleId,
        serviceDate: parsedServiceDate,
        fileNo: fileNo || null,
        kmDriven: kmDriven ? parseInt(kmDriven) : null,
        jobcardStatus: jobcardStatus || "Under Service",
      },
      include: {
        customer: true,
        vehicle: true,
      },
    })

    await createRoleNotifications(["admin", "manager"], {
      title: "New Job Card Created",
      body: `${jobCard.jobCardNumber} for ${jobCard.vehicle?.registrationNumber || "Unknown vehicle"}`,
      targetForm: "update-job-card",
      url: `/?form=update-job-card&jobCardId=${encodeURIComponent(jobCard.id)}`,
      type: "job_created",
      refType: "jobcard",
      refId: jobCard.id,
    })

    return NextResponse.json(jobCard, { status: 201 })
  } catch (error) {
    console.error("[JOBCARDS_POST]", error)

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "JobCard number already exists" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create jobcard" },
      { status: 500 }
    )
  }
}
