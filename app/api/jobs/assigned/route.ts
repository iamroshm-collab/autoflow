import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employeeRefId = (user as any).employeeRefId
  if (!employeeRefId || !Number.isInteger(Number(employeeRefId))) {
    return NextResponse.json({ error: "No employee profile linked to this account" }, { status: 403 })
  }

  const allocations = await prismaClient.technicianAllocation.findMany({
    where: { employeeId: Number(employeeRefId) },
    include: {
      jobCard: {
        select: {
          id: true,
          jobCardNumber: true,
          jobcardStatus: true,
          serviceDate: true,
          vehicle: {
            select: {
              registrationNumber: true,
              make: true,
              model: true,
              year: true,
            },
          },
          customer: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  })

  return NextResponse.json({ allocations })
}
