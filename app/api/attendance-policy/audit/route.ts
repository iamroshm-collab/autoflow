import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { resolveCompanyId } from "@/lib/attendance-policy"

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String(currentUser.role || "").toLowerCase()
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = resolveCompanyId(
      request.nextUrl.searchParams.get("companyId") || request.headers.get("x-company-id")
    )

    const policy = await prisma.attendancePolicy.findUnique({
      where: { companyId },
      select: { policyId: true },
    })

    if (!policy) {
      return NextResponse.json([])
    }

    const logs = await prisma.attendancePolicyAuditLog.findMany({
      where: {
        policyId: policy.policyId,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 50,
      select: {
        id: true,
        changedBy: true,
        oldValue: true,
        newValue: true,
        timestamp: true,
      },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("GET /api/attendance-policy/audit error", error)
    return NextResponse.json({ error: "Failed to fetch policy audit logs" }, { status: 500 })
  }
}
