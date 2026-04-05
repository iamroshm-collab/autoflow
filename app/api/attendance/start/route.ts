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
import { recognizeFace } from "@/lib/face-recognition"
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

    // 6. Activate the USB camera and capture a single frame
    const timestamp = Date.now()
    const captureFilename = `attendance-${employeeId}-${attendanceType.toLowerCase()}-${timestamp}.jpg`

    let capture: Awaited<ReturnType<typeof captureFrameFromUSBCamera>>
    try {
      capture = await captureFrameFromUSBCamera(captureFilename)
    } catch (err) {
      console.error("[ATTENDANCE_START] Camera capture failed:", err)
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

    // 7. Run server-side face recognition
    const referenceImagePath = resolveReferenceImagePath(employee.facePhotoUrl)

    const faceResult = await recognizeFace({
      capturedImagePath: capture.filePath,
      referenceImagePath,
    })

    if (faceResult.status === "no_face_detected") {
      return NextResponse.json(
        {
          success: false,
          message:
            "No face detected in the camera image. " +
            "Please stand in front of the attendance camera and try again.",
          status: faceResult.status,
        },
        { status: 422 }
      )
    }

    if (faceResult.status === "error") {
      console.error("[ATTENDANCE_START] Face recognition error:", faceResult.reason)
      return NextResponse.json(
        {
          success: false,
          message: "Face recognition service encountered an error. Please try again.",
          status: faceResult.status,
        },
        { status: 503 }
      )
    }

    if (!faceResult.matched) {
      return NextResponse.json(
        {
          success: false,
          message: "Face verification failed",
          status: faceResult.status,
        },
        { status: 200 } // 200 so the client can display a user-friendly message without treating it as a network error
      )
    }

    // 8. Record attendance in the database
    let attendanceRecord: Awaited<ReturnType<typeof recordAttendance>>
    try {
      attendanceRecord = await recordAttendance({
        employeeId,
        deviceId,
        attendanceType: attendanceType as "IN" | "OUT",
        capturedImagePath: capture.publicUrl,
        verificationStatus: faceResult.status,
        verificationScore: faceResult.score,
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
