import { NextRequest, NextResponse } from "next/server"
import {
  getOrCreateAttendancePolicy,
  mergeWithDefaultPolicy,
  resolveCompanyId,
  runAttendancePolicyPreview,
  isHolidayFromPolicy,
} from "@/lib/attendance-policy"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const companyId = resolveCompanyId(
      body?.company_id || request.nextUrl.searchParams.get("companyId") || request.headers.get("x-company-id")
    )

    const basePolicy = await getOrCreateAttendancePolicy(companyId)
    const policy = body?.policy ? mergeWithDefaultPolicy(body.policy, companyId) : basePolicy

    const checkInTime = String(body?.check_in_time || "").trim()
    const checkOutTime = String(body?.check_out_time || "").trim()
    const date = String(body?.date || "").trim()

    if (!checkInTime || !checkOutTime) {
      return NextResponse.json({ error: "check_in_time and check_out_time are required" }, { status: 400 })
    }

    const preview = runAttendancePolicyPreview({
      checkInTime,
      checkOutTime,
      policy,
      isHoliday: date ? isHolidayFromPolicy(date, policy) : false,
      hasApprovedLeave: Boolean(body?.has_approved_leave),
    })

    if ((preview as any).error) {
      return NextResponse.json({ error: (preview as any).error }, { status: 400 })
    }

    return NextResponse.json(preview)
  } catch (error) {
    console.error("POST /api/attendance-policy/preview error", error)
    return NextResponse.json({ error: "Failed to run attendance policy preview" }, { status: 500 })
  }
}
