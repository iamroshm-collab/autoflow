/**
 * Attendance Database Service
 *
 * All database reads and writes for the server-side attendance flow are
 * centralised here, keeping the API route thin.
 */

import { prisma } from "@/lib/prisma"
import {
  calculateWorkedMinutes,
  deriveNextAttendanceAction,
  formatWorkedDuration,
  isAdminLikeDesignation,
  toDayStart,
  toNextDay,
} from "@/lib/attendance"
import { deriveAttendanceStatusFromPolicy, getOrCreateAttendancePolicy } from "@/lib/attendance-policy"
import { evaluateCheckIn, evaluateCheckOut } from "@/lib/shift"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EligibleEmployee {
  employeeId: number
  empName: string
  mobile: string
  designation: string | null
  facePhotoUrl: string | null
  registeredDeviceId: string | null
  isAttendanceEligible: boolean
}

export interface RecordAttendanceInput {
  employeeId: number
  deviceId: string
  attendanceType: "IN" | "OUT"
  capturedImagePath: string | null
  verificationStatus: "verified" | "rejected" | "no_face_detected" | "error"
  verificationScore: number | null
}

export interface AttendanceRecordResult {
  attendanceId: number
  employeeId: number
  attendance: string
  checkInAt: Date | null
  checkOutAt: Date | null
  workedMinutes: number | null
  workedDuration: string
  verificationStatus: string | null
  capturedImagePath: string | null
  markedDeviceId: string | null
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getEligibleEmployee(employeeId: number): Promise<EligibleEmployee | null> {
  return prisma.employee.findFirst({
    where: {
      employeeId,
      isArchived: false,
      isAttendanceEligible: true,
    },
    select: {
      employeeId: true,
      empName: true,
      mobile: true,
      designation: true,
      facePhotoUrl: true,
      registeredDeviceId: true,
      isAttendanceEligible: true,
    },
  })
}

export async function getTodayAttendanceRecord(employeeId: number) {
  return prisma.attendancePayroll.findFirst({
    where: {
      employeeId,
      attendanceDate: {
        gte: toDayStart(new Date()),
        lt: toNextDay(new Date()),
      },
    },
  })
}

export async function getLastAttendanceRecord(employeeId: number) {
  return prisma.attendancePayroll.findFirst({
    where: { employeeId },
    orderBy: [{ attendanceDate: "desc" }, { attendanceId: "desc" }],
  })
}

export async function getAttendanceSummary(employeeId: number) {
  const [last, today] = await Promise.all([
    getLastAttendanceRecord(employeeId),
    getTodayAttendanceRecord(employeeId),
  ])

  return {
    nextAction: deriveNextAttendanceAction(last),
    todayRecord: today
      ? {
          attendance: today.attendance,
          checkInAt: today.checkInAt?.toISOString() ?? null,
          checkOutAt: today.checkOutAt?.toISOString() ?? null,
          workedDuration: formatWorkedDuration(today.workedMinutes),
          verificationStatus: today.verificationStatus ?? null,
          markedDeviceId: (today as Record<string, unknown>).markedDeviceId as string | null ?? null,
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function recordAttendance(
  input: RecordAttendanceInput
): Promise<AttendanceRecordResult> {
  const now = new Date()
  const attendanceDate = toDayStart(now)
  const todayRecord = await getTodayAttendanceRecord(input.employeeId)

  const sharedData = {
    attendanceMethod: "device_face",
    verificationProvider: "server_usb_camera",
    verificationStatus: input.verificationStatus,
    markedDeviceId: input.deviceId,
  }

  let record: Awaited<ReturnType<typeof prisma.attendancePayroll.create>>

  if (input.attendanceType === "IN") {
    const capturedImageField = { checkInVideoUrl: input.capturedImagePath }
    // Determine shift settings (employee-specific or defaults)
    const empShift = await prisma.employeeShift.findUnique({ where: { employeeId: input.employeeId } })
    const shiftStart = empShift?.shiftStart ?? process.env.DEFAULT_SHIFT_START ?? "09:00"
    const grace = Number(process.env.DEFAULT_SHIFT_GRACE_MINS ?? empShift?.gracePeriodMins ?? 10)

    const checkInEval = evaluateCheckIn(now, shiftStart, grace)

    if (todayRecord) {
      record = await prisma.attendancePayroll.update({
        where: { attendanceId: todayRecord.attendanceId },
        data: {
          attendance: "IN",
          checkInAt: now,
          checkOutAt: null,
          workedMinutes: null,
          checkInVerificationScore: input.verificationScore,
          checkInStatus: checkInEval.status,
          lateMinutes: checkInEval.lateMinutes,
          ...capturedImageField,
          ...sharedData,
        },
      })
    } else {
      record = await prisma.attendancePayroll.create({
        data: {
          employeeId: input.employeeId,
          attendanceDate,
          attendance: "IN",
          checkInAt: now,
          checkInVerificationScore: input.verificationScore,
          checkInStatus: checkInEval.status,
          lateMinutes: checkInEval.lateMinutes,
          ...capturedImageField,
          ...sharedData,
        },
      })
    }
  } else {
    if (!todayRecord?.checkInAt || todayRecord.checkOutAt) {
      throw new Error("You must check in before you can check out")
    }

    const workedMinutes = calculateWorkedMinutes(todayRecord.checkInAt, now)
    const policy = await getOrCreateAttendancePolicy()

    const empShift = await prisma.employeeShift.findUnique({ where: { employeeId: input.employeeId } })
    const shiftEnd = empShift?.shiftEnd ?? process.env.DEFAULT_SHIFT_END ?? "18:00"
    const overtimeThreshold = Number(process.env.DEFAULT_SHIFT_OVERTIME_MINS ?? empShift?.overtimeThresholdMins ?? 30)

    const checkOutEval = evaluateCheckOut(now, shiftEnd, overtimeThreshold)

    record = await prisma.attendancePayroll.update({
      where: { attendanceId: todayRecord.attendanceId },
      data: {
        attendance: deriveAttendanceStatusFromPolicy(workedMinutes, policy),
        checkOutAt: now,
        workedMinutes,
        checkOutVideoUrl: input.capturedImagePath,
        checkOutVerificationScore: input.verificationScore,
        checkOutStatus: checkOutEval.status,
        ...sharedData,
      },
    })
  }

  return {
    attendanceId: record.attendanceId,
    employeeId: record.employeeId,
    attendance: record.attendance,
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt,
    workedMinutes: record.workedMinutes ?? null,
    workedDuration: formatWorkedDuration(record.workedMinutes ?? null),
    verificationStatus: record.verificationStatus ?? null,
    capturedImagePath: input.capturedImagePath,
    markedDeviceId: (record as Record<string, unknown>).markedDeviceId as string | null ?? null,
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the given deviceId matches the employee's registered device.
 */
export function isDeviceAuthorized(employee: EligibleEmployee, deviceId: string): boolean {
  if (!employee.registeredDeviceId) return false
  return employee.registeredDeviceId === deviceId
}

/**
 * Guards against admin-role employees being targeted through this endpoint.
 */
export function isEligibleForMobileAttendance(employee: EligibleEmployee): boolean {
  return (
    employee.isAttendanceEligible && !isAdminLikeDesignation(employee.designation)
  )
}
