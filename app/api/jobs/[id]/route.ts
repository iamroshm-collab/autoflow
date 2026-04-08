import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employeeRefId = (user as any).employeeRefId
  if (!employeeRefId || !Number.isInteger(Number(employeeRefId))) {
    return NextResponse.json({ error: "No employee record linked to this account." }, { status: 403 })
  }

  const { id: jobId } = await params

  // Verify this employee has an allocation for this job
  const allocation = await prismaClient.technicianAllocation.findFirst({
    where: { jobId, employeeId: Number(employeeRefId) },
  })

  if (!allocation) {
    return NextResponse.json({ error: "Job not found or not assigned to you." }, { status: 404 })
  }

  const jobCard = await prismaClient.jobCard.findUnique({
    where: { id: jobId },
    include: {
      vehicle: {
        select: {
          registrationNumber: true,
          make: true,
          model: true,
          year: true,
        },
      },
      customer: {
        select: { name: true, mobileNo: true },
      },
      serviceDescriptions: {
        orderBy: { sl: "asc" },
        select: {
          id: true,
          sl: true,
          description: true,
          sparePart: true,
          qnty: true,
          salePrice: true,
          amount: true,
          totalAmount: true,
        },
      },
      technicianAllocations: {
        where: { employeeId: Number(employeeRefId) },
        select: {
          id: true,
          status: true,
          taskAssigned: true,
          assignedAt: true,
          acceptedAt: true,
          startedAt: true,
          completedAt: true,
          earningAmount: true,
        },
      },
    },
  })

  if (!jobCard) {
    return NextResponse.json({ error: "Job card not found." }, { status: 404 })
  }

  return NextResponse.json({ jobCard })
}
