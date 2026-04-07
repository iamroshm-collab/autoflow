import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { getEligibleEmployee } from "@/lib/attendance-db"
import { verifyEmployeeMultiFrame } from "@/lib/multi-frame-verifier"
import { issueToken } from "@/lib/correction-tokens"
import { captureFrameFromUSBCamera } from "@/lib/camera-capture"

export async function POST(request: NextRequest, { params }: { params: { employeeId: string } }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ verified: false, message: "Forbidden" }, { status: 403 })
    }

    // Parse and validate employeeId
    const rawId = String(params.employeeId).trim()
    console.log(`[VERIFY_START] Raw employeeId param: "${rawId}"`)

    const employeeId = parseInt(rawId, 10)
    console.log(`[VERIFY_START] Parsed to: ${employeeId}, isNaN: ${isNaN(employeeId)}, isInteger: ${Number.isInteger(employeeId)}`)

    if (isNaN(employeeId) || employeeId <= 0) {
      console.log(`[VERIFY_START] REJECT - Invalid employeeId: ${employeeId}`)
      return NextResponse.json({
        verified: false,
        message: `Invalid employeeId: "${rawId}" parsed as ${employeeId}`
      }, { status: 400 })
    }

    console.log(`[VERIFY_START] Valid employeeId: ${employeeId}`)
    const employee = await getEligibleEmployee(employeeId)

    if (!employee) {
      console.log(`[VERIFY_START] Employee ${employeeId} not found or not eligible`)
      return NextResponse.json({ verified: false, message: "Employee not found or not eligible" }, { status: 404 })
    }

    console.log(`[VERIFY_START] Employee found: ${employee.empName}, facePhotoUrl: ${employee.facePhotoUrl ? 'present' : 'missing'}`)
    const referenceImagePath = employee.facePhotoUrl || ""

    const verification = await verifyEmployeeMultiFrame(employeeId, referenceImagePath)

    if (!verification.confirmed) {
      console.log(`[VERIFY_START] Verification not confirmed: ${verification.message}`)
      return NextResponse.json({ verified: false, message: verification.message })
    }

    // Choose best frame public URL or capture fallback
    const bestFrame = verification.frameResults.filter((f) => f.capturedImagePublicUrl).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
    let imagePublicUrl = bestFrame?.capturedImagePublicUrl ?? null

    if (!imagePublicUrl) {
      try {
        const ts = Date.now()
        const capture = await captureFrameFromUSBCamera(`correction-${employeeId}-${ts}.jpg`)
        imagePublicUrl = capture.publicUrl
      } catch (err) {
        console.error("Failed to capture correction verification image:", err)
      }
    }

    const token = issueToken(employeeId, imagePublicUrl ?? "", verification.avgScore)
    const expiresAt = Date.now() + Number(process.env.CORRECTION_TOKEN_TTL_MS ?? 300000)

    console.log(`[VERIFY_START] SUCCESS for employeeId ${employeeId}`)
    return NextResponse.json({ verified: true, token, expiresAt, similarity: verification.avgScore })
  } catch (err) {
    console.error("/corrections/verify error", err)
    return NextResponse.json({ verified: false, message: `Verification failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }
}
