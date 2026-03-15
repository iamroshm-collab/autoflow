import { NextRequest, NextResponse } from "next/server"
import { getPendingAllocations, getTechnicianAllocations } from "@/services/jobAllocationService"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const technicianId = Number(searchParams.get("technicianId"))
    const status = searchParams.get("status") || undefined
    const pending = searchParams.get("pending") === "true"

    if (!Number.isInteger(technicianId)) {
      return NextResponse.json({ error: "technicianId is required" }, { status: 400 })
    }

    const allocations = pending
      ? await getPendingAllocations(technicianId)
      : await getTechnicianAllocations(technicianId, status)

    return NextResponse.json({ success: true, allocations })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch technician jobs" },
      { status: 500 }
    )
  }
}
