import { NextRequest, NextResponse } from "next/server"
import { getEmployeeStats } from "@/lib/employee-stats"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const employeeId = parseInt(id, 10)
  if (!employeeId || employeeId <= 0) {
    return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
  }

  try {
    const stats = await getEmployeeStats(employeeId)
    return NextResponse.json(stats)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load employee stats" },
      { status: 500 }
    )
  }
}
