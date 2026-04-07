/**
 * POST /api/attendance/start
 *
 * Endpoint called by the employee's phone when they tap Mark IN or Mark OUT.
 * The phone is already authenticated via device_id-based session.
 *
 * Flow:
 *  1. Validate session + device_id matches employee's registered device.
 *  2. Activate the USB camera on the server, capture one frame.
 *  3. Run server-side face recognition against the employee's reference photo.
 *  4. If face matches → record attendance and return success.
 *  5. If face does not match → return "Face verification failed".
 *
 * Request body:
 *  {
 *    employee_id:      number
 *    device_id:        string
 *    attendance_type:  "IN" | "OUT"
 *  }
 *
 * Response (success):
 *  { success: true, message: "Attendance recorded", record: { ... } }
 *
 * Response (failure):
 *  { success: false, message: "Face verification failed", status: "..." }
 */

import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { captureFrameFromUSBCamera } from "@/lib/camera-capture"
import { verifyEmployeeMultiFrame } from "@/lib/multi-frame-verifier"
import {
  getEligibleEmployee,
  isDeviceAuthorized,
  isEligibleForMobileAttendance,
  recordAttendance,
  getAttendanceSummary,
} from "@/lib/attendance-db"
import { deriveNextAttendanceAction } from "@/lib/attendance"

// ---------------------------------------------------------------------------
// Helper: resolve local path for the employee reference photo
// ---------------------------------------------------------------------------

function resolveReferenceImagePath(facePhotoUrl: string): string {
  // If it's already an absolute path (stored locally), use it directly
  if (path.isAbsolute(facePhotoUrl)) return facePhotoUrl

  // If it's a relative public URL like /uploads/... → resolve to disk path
  if (facePhotoUrl.startsWith("/")) {
    return path.join(process.cwd(), "public", facePhotoUrl)
  }

  // External URL (http/https) — Python script handles downloading it
  return facePhotoUrl
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the session
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse and validate request body
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON in request body" },
        { status: 400 }
      )
    }

    const employeeId = Number(body.employee_id)
    const deviceId = String(body.device_id ?? "").trim()
    const attendanceType = String(body.attendance_type ?? "").toUpperCase()

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid employee_id is required" },
        { status: 400 }
      )
    }

    if (!deviceId) {
      return NextResponse.json(
        { success: false, message: "device_id is required" },
        { status: 400 }
      )
    }

    if (attendanceType !== "IN" && attendanceType !== "OUT") {
      return NextResponse.json(
        { success: false, message: "attendance_type must be IN or OUT" },
        { status: 400 }
      )
    }

    // 3. Enforce that technicians can only mark their own attendance
    const isAdminLike = currentUser.role === "admin" || currentUser.role === "manager"
    if (!isAdminLike) {
      if (!Number.isInteger(currentUser.employeeRefId)) {
        return NextResponse.json(
          { success: false, message: "Your account is not mapped to an employee profile" },
          { status: 400 }
        )
      }
      if (Number(currentUser.employeeRefId) !== employeeId) {
        return NextResponse.json(
          { success: false, message: "You can only mark your own attendance" },
          { status: 403 }
        )
      }
    }

    // 4. Load and validate the employee
    const employee = await getEligibleEmployee(employeeId)

    if (!employee || !isEligibleForMobileAttendance(employee)) {
      return NextResponse.json(
        { success: false, message: "Employee is not eligible for attendance" },
        { status: 404 }
      )
    }

    if (!employee.facePhotoUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "Reference photo is missing for this employee. Ask admin to upload it first.",
        },
        { status: 400 }
      )
    }

    // 5. Verify that the device_id matches the employee's registered device
    if (!isDeviceAuthorized(employee, deviceId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Device is not authorized for this employee. Contact admin to register your device.",
        },
        { status: 403 }
      )
    }

    // 6. Run multi-frame verification (captures multiple frames internally)
    const referenceImagePath = resolveReferenceImagePath(employee.facePhotoUrl)

    const verification = await verifyEmployeeMultiFrame(employeeId, referenceImagePath)

    // If all frames show no face detected, return 422 similar to previous behaviour
    const allNoFace = verification.frameResults.length > 0 && verification.frameResults.every((f) => f.status === "no_face_detected")
    if (allNoFace) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No face detected in the camera image. " +
            "Please stand in front of the attendance camera and try again.",
          status: "no_face_detected",
        },
        { status: 422 }
      )
    }

    // If verifier returned an error-like outcome with zero votes, return a service error
    if (!verification.confirmed && verification.voteCount === 0) {
      console.error("[ATTENDANCE_START] Face verification failed:", verification.message)
      return NextResponse.json(
        {
          success: false,
          message: "Face recognition service encountered an error. Please try again.",
          status: "error",
        },
        { status: 503 }
      )
    }

    if (!verification.confirmed) {
      return NextResponse.json(
        {
          success: false,
          message: "Face verification failed",
          status: verification.message,
        },
        { status: 200 }
      )
    }

    // Determine best captured frame (highest score) and its public URL when available
    const bestFrame = verification.frameResults
      .filter((f) => typeof f.score === "number" && f.capturedImagePublicUrl)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]

    const fallbackFrame = verification.frameResults.find((f) => f.capturedImagePublicUrl) || verification.frameResults[0]

    const chosenPublicUrl = bestFrame?.capturedImagePublicUrl ?? fallbackFrame?.capturedImagePublicUrl ?? null


    // 8. Ensure we have a public URL for the chosen frame to store with the record
    let finalPublicUrl = chosenPublicUrl
    if (!finalPublicUrl) {
      try {
        const ts = Date.now()
        const fallbackCapture = await captureFrameFromUSBCamera(`attendance-${employeeId}-fallback-${ts}.jpg`)
        finalPublicUrl = fallbackCapture.publicUrl
      } catch (err) {
        console.error("[ATTENDANCE_START] Failed to capture fallback image:", err)
        return NextResponse.json(
          {
            success: false,
            message:
              "Could not capture image from the attendance camera. " +
              "Make sure the USB camera is connected to the server.",
          },
          { status: 503 }
        )
      }
    }

    // 9. Record attendance in the database
    let attendanceRecord: Awaited<ReturnType<typeof recordAttendance>>
    try {
      attendanceRecord = await recordAttendance({
        employeeId,
        deviceId,
        attendanceType: attendanceType as "IN" | "OUT",
        capturedImagePath: finalPublicUrl,
        verificationStatus: "verified",
        verificationScore: verification.avgScore,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save attendance record"
      return NextResponse.json({ success: false, message: msg }, { status: 400 })
    }

    // 9. Return a clean response to the phone UI
    const summary = await getAttendanceSummary(employeeId)

    return NextResponse.json({
      success: true,
      message: "Attendance recorded",
      record: {
        attendanceId: attendanceRecord.attendanceId,
        attendance: attendanceRecord.attendance,
        checkInAt: attendanceRecord.checkInAt?.toISOString() ?? null,
        checkOutAt: attendanceRecord.checkOutAt?.toISOString() ?? null,
        workedDuration: attendanceRecord.workedDuration,
        verificationStatus: attendanceRecord.verificationStatus,
        capturedImageUrl: attendanceRecord.capturedImagePath,
        markedDeviceId: attendanceRecord.markedDeviceId,
      },
      nextAction: deriveNextAttendanceAction(
        summary.todayRecord
          ? {
              attendance: summary.todayRecord.attendance,
              checkInAt: summary.todayRecord.checkInAt
                ? new Date(summary.todayRecord.checkInAt)
                : null,
              checkOutAt: summary.todayRecord.checkOutAt
                ? new Date(summary.todayRecord.checkOutAt)
                : null,
            }
          : null
      ),
    })
  } catch (error) {
    console.error("[ATTENDANCE_START]", error)
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
