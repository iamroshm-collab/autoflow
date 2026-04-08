import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const employeeRefId = (user as any).employeeRefId
  if (!employeeRefId) return NextResponse.json({ error: "No employee record linked." }, { status: 403 })

  const { id } = await params
  const allocation = await prismaClient.technicianAllocation.findFirst({
    where: { jobId: id, employeeId: Number(employeeRefId) },
  })

  if (!allocation) return NextResponse.json({ error: "Job not assigned to you." }, { status: 404 })
  if (allocation.status === "completed") {
    return NextResponse.json({ error: "Job is already completed." }, { status: 409 })
  }

  const now = new Date()
  const updated = await prismaClient.technicianAllocation.update({
    where: { id: allocation.id },
    data: {
      status: "completed",
      completedAt: now,
      startedAt: allocation.startedAt ?? now,
      acceptedAt: allocation.acceptedAt ?? now,
    },
  })

  return NextResponse.json({ allocation: updated })
}
