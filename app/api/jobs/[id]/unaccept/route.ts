import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

/**
 * POST /api/jobs/[id]/unaccept
 *
 * Reverses a technician's acceptance of a job allocation, moving it back to
 * "assigned" status.  Allowed by:
 *   - The assigned technician whose allocation is in "accepted" state
 *   - Admin or manager (explicit oversight path)
 *
 * Blocked when the allocation is already in_progress or completed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = String((user as any).role || "").toLowerCase()
  const isAdmin = role === "admin" || role === "manager"
  const isTech = role === "technician"
  const employeeRefId = (user as any).employeeRefId ? Number((user as any).employeeRefId) : null

  const { id: jobId } = await params

  // Admins can reverse any accepted allocation for this job
  // Technicians can only reverse their own
  let allocation: any

  if (isAdmin) {
    // Optionally scope by allocationId sent in body
    const body = await request.json().catch(() => ({}))
    const allocationId: string | undefined = body.allocationId

    if (allocationId) {
      allocation = await prismaClient.technicianAllocation.findFirst({
        where: { id: allocationId, jobId },
      })
    } else {
      // Admin without a specific allocation — find the first accepted one
      allocation = await prismaClient.technicianAllocation.findFirst({
        where: { jobId, status: "accepted" },
        orderBy: { acceptedAt: "desc" },
      })
    }
  } else if (isTech) {
    if (!employeeRefId) {
      return NextResponse.json({ error: "No employee record linked." }, { status: 403 })
    }
    allocation = await prismaClient.technicianAllocation.findFirst({
      where: { jobId, employeeId: employeeRefId },
    })
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!allocation) {
    return NextResponse.json({ error: "Allocation not found or not assigned to you." }, { status: 404 })
  }

  if (allocation.status !== "accepted") {
    if (allocation.status === "in_progress" || allocation.status === "completed") {
      return NextResponse.json(
        { error: `Cannot reverse acceptance — work is already ${allocation.status.replace("_", " ")}.` },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: `Allocation is not in accepted state (current: ${allocation.status}).` },
      { status: 409 }
    )
  }

  const updated = await prismaClient.technicianAllocation.update({
    where: { id: allocation.id as string },
    data: {
      status: "assigned",
      acceptedAt: null,
    },
  })

  return NextResponse.json({ allocation: updated })
}
