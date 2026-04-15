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

  const role = String((user as any).role || "").toLowerCase()
  // Admins must not accept on behalf of a technician
  if (role === "admin" || role === "manager") {
    return NextResponse.json(
      { error: "Admins cannot accept a job allocation. Only the assigned technician can." },
      { status: 403 }
    )
  }

  const employeeRefId = (user as any).employeeRefId
  if (!employeeRefId) return NextResponse.json({ error: "No employee record linked." }, { status: 403 })

  const { id } = await params
  // Scope to current employee — prevents one technician from accepting another's allocation
  const allocation = await prismaClient.technicianAllocation.findFirst({
    where: { jobId: id, employeeId: Number(employeeRefId) },
  })

  if (!allocation) return NextResponse.json({ error: "Job not assigned to you." }, { status: 404 })
  if (allocation.status !== "assigned") {
    return NextResponse.json({ error: "Job has already been accepted." }, { status: 409 })
  }

  const updated = await prismaClient.technicianAllocation.update({
    where: { id: allocation.id as string },
    data: { status: "accepted", acceptedAt: new Date() },
  })

  return NextResponse.json({ allocation: updated })
}
