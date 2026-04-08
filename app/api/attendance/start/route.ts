/**
 * POST /api/attendance/start
 *
 * Employee marks attendance from their phone.
 * The phone captures a selfie via browser camera and sends it as a
 * base64 data-URL. The server verifies the device ID, saves the photo,
 * and records attendance — no Python or ffmpeg required.
 *
 * Request body:
 *  {
 *    employee_id:      number
 *    device_id:        string
 *    attendance_type:  "IN" | "OUT"
 *    captured_photo?:  string   // base64 data-URL (image/jpeg or image/png)
 *  }
 */

import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import {
  getEligibleEmployee,
  isDeviceAuthorized,
  isEligibleForMobileAttendance,
  recordAttendance,
  getAttendanceSummary,
} from "@/lib/attendance-db"
import { deriveNextAttendanceAction } from "@/lib/attendance"

const CAPTURES_DIR =
  process.env.ATTENDANCE_CAPTURES_DIR ??
  path.join(process.cwd(), "public", "uploads", "attendance-captures")

async function saveBase64Photo(
  base64DataUrl: string,
  filename: string
): Promise<string> {
  // Strip the data-URL prefix (data:image/jpeg;base64,...)
  const matches = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) throw new Error("Invalid image format")
  const buffer = Buffer.from(matches[2], "base64")
  await fs.mkdir(CAPTURES_DIR, { recursive: true })
  const filePath = path.join(CAPTURES_DIR, filename)
  await fs.writeFile(filePath, buffer)
  return `/uploads/attendance-captures/${filename}`
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse body
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
    }

    const employeeId = Number(body.employee_id)
    const deviceId = String(body.device_id ?? "").trim()
    const attendanceType = String(body.attendance_type ?? "").toUpperCase()
    const capturedPhoto = typeof body.captured_photo === "string" ? body.captured_photo : null
    const verificationScore =
      typeof body.verification_score === "number" && isFinite(body.verification_score)
        ? (body.verification_score as number)
        : null

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return NextResponse.json({ success: false, message: "Valid employee_id is required" }, { status: 400 })
    }
    if (!deviceId) {
      return NextResponse.json({ success: false, message: "device_id is required" }, { status: 400 })
    }
    if (attendanceType !== "IN" && attendanceType !== "OUT") {
      return NextResponse.json({ success: false, message: "attendance_type must be IN or OUT" }, { status: 400 })
    }

    // 3. Enforce technicians can only mark their own attendance
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

    // 4. Load and validate employee
    const employee = await getEligibleEmployee(employeeId)
    if (!employee || !isEligibleForMobileAttendance(employee)) {
      return NextResponse.json(
        { success: false, message: "Employee is not eligible for attendance" },
        { status: 404 }
      )
    }

    // 5. Verify device is authorized
    if (!isDeviceAuthorized(employee, deviceId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Device is not authorized for this employee. Contact admin to register your device.",
        },
        { status: 403 }
      )
    }

    // 6. Save selfie photo if provided (audit trail)
    let capturedImageUrl: string | null = null
    if (capturedPhoto) {
      try {
        const ts = Date.now()
        const ext = capturedPhoto.startsWith("data:image/png") ? "png" : "jpg"
        const filename = `attendance-${employeeId}-${attendanceType.toLowerCase()}-${ts}.${ext}`
        capturedImageUrl = await saveBase64Photo(capturedPhoto, filename)
      } catch (err) {
        console.warn("[ATTENDANCE_START] Failed to save captured photo:", err)
        // Non-fatal — proceed without photo
      }
    }

    // 7. Record attendance
    let attendanceRecord: Awaited<ReturnType<typeof recordAttendance>>
    try {
      attendanceRecord = await recordAttendance({
        employeeId,
        deviceId,
        attendanceType: attendanceType as "IN" | "OUT",
        capturedImagePath: capturedImageUrl,
        verificationStatus: "verified",
        verificationScore,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save attendance record"
      return NextResponse.json({ success: false, message: msg }, { status: 400 })
    }

    // 8. Return response
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
              checkInAt: summary.todayRecord.checkInAt ? new Date(summary.todayRecord.checkInAt) : null,
              checkOutAt: summary.todayRecord.checkOutAt ? new Date(summary.todayRecord.checkOutAt) : null,
            }
          : null
      ),
    })
  } catch (error) {
    console.error("[ATTENDANCE_START]", error)
    return NextResponse.json({ success: false, message: "An unexpected error occurred" }, { status: 500 })
  }
}
