import { NextRequest, NextResponse } from "next/server"
import { completeJobAllocation } from "@/services/jobAllocationService"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ allocationId: string }> }
) {
  try {
    const { allocationId } = await params
    if (!allocationId) {
      return NextResponse.json({ error: "allocationId is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const allocation = await completeJobAllocation(allocationId, body.earningAmount)
    return NextResponse.json({ success: true, allocation })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to complete job" },
      { status: 500 }
    )
  }
}
