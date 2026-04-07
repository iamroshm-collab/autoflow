import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")

    if (employeeId) {
      const id = Number(employeeId)
      if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid employeeId" }, { status: 400 })
      const shift = await prisma.employeeShift.findUnique({ where: { employeeId: id } })
      return NextResponse.json(shift)
    }

    const shifts = await prisma.employeeShift.findMany({ take: 200 })
    return NextResponse.json(shifts)
  } catch (err) {
    console.error("Error fetching shifts", err)
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser || currentUser.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const employeeId = Number(body.employeeId)
    const shiftStart = String(body.shiftStart || "").trim()
    const shiftEnd = String(body.shiftEnd || "").trim()
    const grace = Number(body.gracePeriodMins || 10)
    const overtime = Number(body.overtimeThresholdMins || 30)

    if (!Number.isInteger(employeeId) || !shiftStart || !shiftEnd) {
      return NextResponse.json({ error: "employeeId, shiftStart, shiftEnd required" }, { status: 400 })
    }

    const existing = await prisma.employeeShift.findUnique({ where: { employeeId } })
    let result
    if (existing) {
      result = await prisma.employeeShift.update({ where: { employeeId }, data: { shiftStart, shiftEnd, gracePeriodMins: grace, overtimeThresholdMins: overtime } })
    } else {
      result = await prisma.employeeShift.create({ data: { employeeId, shiftStart, shiftEnd, gracePeriodMins: grace, overtimeThresholdMins: overtime } })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("Error saving shift", err)
    return NextResponse.json({ error: "Failed to save shift" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser || currentUser.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 })
    const id = Number(employeeId)
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid employeeId" }, { status: 400 })

    await prisma.employeeShift.deleteMany({ where: { employeeId: id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error deleting shift", err)
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 })
  }
}
