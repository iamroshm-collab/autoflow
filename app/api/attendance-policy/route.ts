import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { getOrCreateAttendancePolicy, resolveCompanyId, saveAttendancePolicy } from "@/lib/attendance-policy"

const canManagePolicy = (role: string) => {
  return role === "admin" || role === "manager"
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = resolveCompanyId(
      request.nextUrl.searchParams.get("companyId") || request.headers.get("x-company-id")
    )

    const policy = await getOrCreateAttendancePolicy(companyId)
    return NextResponse.json(policy)
  } catch (error) {
    console.error("GET /api/attendance-policy error", error)
    return NextResponse.json({ error: "Failed to fetch attendance policy" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String(currentUser.role || "").toLowerCase()
    if (!canManagePolicy(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const companyId = resolveCompanyId(
      body?.company_id || request.nextUrl.searchParams.get("companyId") || request.headers.get("x-company-id")
    )

    const changedBy =
      String((currentUser as any).email || "").trim() ||
      String((currentUser as any).name || "").trim() ||
      String((currentUser as any).id || "").trim() ||
      "system"

    const saved = await saveAttendancePolicy({
      companyId,
      policy: {
        ...body,
        company_id: companyId,
      },
      changedBy,
    })

    return NextResponse.json({ success: true, policy: saved })
  } catch (error) {
    console.error("PUT /api/attendance-policy error", error)
    return NextResponse.json({ error: "Failed to save attendance policy" }, { status: 500 })
  }
}
