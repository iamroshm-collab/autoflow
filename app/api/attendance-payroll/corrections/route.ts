import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String(currentUser.role || "").toLowerCase()
    if (role === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const employeeIdParam = searchParams.get("employeeId")
    const whereClause: any = {}
    if (employeeIdParam) {
      const id = Number(employeeIdParam)
      if (Number.isInteger(id)) {
        whereClause.employeeId = id
      }
    }

    const corrections = await prisma.attendanceCorrection.findMany({
      where: whereClause,
      orderBy: { correctedAt: "desc" },
    })

    // Enrich with employee names
    const employeeIds = Array.from(new Set(corrections.map((c) => c.employeeId)))
    const employees = await prisma.employee.findMany({ where: { employeeId: { in: employeeIds } }, select: { employeeId: true, empName: true } })
    const empMap = new Map(employees.map((e) => [e.employeeId, e.empName]))

    const enriched = corrections.map((c) => ({
      ...c,
      empName: empMap.get(c.employeeId) || null,
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching corrections:", error)
    return NextResponse.json({ error: "Failed to fetch corrections" }, { status: 500 })
  }
}
