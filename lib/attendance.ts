const EARTH_RADIUS_METERS = 6371000
const INDIA_TIMEZONE = "Asia/Kolkata"
const INDIA_OFFSET_MINUTES = 5 * 60 + 30

export type AttendanceAction = "IN" | "OUT"
export type AttendanceCode = "FD" | "PD" | "P" | "H" | "A" | "L" | "IN" | "CL" | "AL" | "ML" | "HPL" | "EL" | "WO" | "PH" | "SL" | "PL" | "CO" | "LWP" | "MED" | "PLT"

/** Salary multiplier for each attendance code (per working day) */
export const ATTENDANCE_SALARY_MULTIPLIER: Record<string, number> = {
  FD:  1.0,  // Full Day
  PD:  0.5,  // Partial Day
  P:   1.0,  // Present (legacy)
  H:   0.5,  // Half Day
  A:   0.0,  // Absent
  L:   1.0,  // Leave (generic, treated as paid)
  CL:  1.0,  // Casual Leave
  AL:  1.0,  // Annual Leave
  ML:  1.0,  // Medical Leave
  HPL: 0.5,  // Half Pay Leave
  EL:  1.0,  // Earned Leave
  SL:  1.0,  // Sick Leave
  PL:  1.0,  // Privilege Leave
  CO:  1.0,  // Compensatory Leave
  MED: 1.0,  // Medical Leave
  PLT: 1.0,  // Paternity Leave
  LWP: 0.0,  // Leave Without Pay
  WO:  0.0,  // Week Off (Sunday / scheduled off — not a deduction)
  PH:  0.0,  // Public Holiday — not a deduction
}

export const OVERTIME_THRESHOLD_HOURS = 9 // hours beyond which is overtime

export function toDayStart(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : new Date(value)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = Number(parts.find((part) => part.type === "year")?.value)
  const month = Number(parts.find((part) => part.type === "month")?.value)
  const day = Number(parts.find((part) => part.type === "day")?.value)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    const fallback = new Date(date)
    fallback.setHours(0, 0, 0, 0)
    return fallback
  }

  const utcTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - INDIA_OFFSET_MINUTES * 60 * 1000
  return new Date(utcTimestamp)
}

export function toNextDay(value: Date | string) {
  const nextDay = toDayStart(value)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  return nextDay
}

export function calculateDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(latitudeB - latitudeA)
  const longitudeDelta = toRadians(longitudeB - longitudeA)
  const normalizedLatitudeA = toRadians(latitudeA)
  const normalizedLatitudeB = toRadians(latitudeB)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(normalizedLatitudeA) *
      Math.cos(normalizedLatitudeB) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine))
}

export function calculateWorkedMinutes(checkInAt: Date, checkOutAt: Date) {
  const differenceMs = checkOutAt.getTime() - checkInAt.getTime()
  if (differenceMs <= 0) {
    return 0
  }

  // Always count a positive session as at least 1 minute.
  return Math.max(1, Math.ceil(differenceMs / 60000))
}

// Business-configurable attendance thresholds
export const TOTAL_WORK_HOURS = 10 // nominal total work hours for a full shift
export const PRESENT_THRESHOLD_HOURS = 7 // >= 7 hours => Present

export function deriveAttendanceCode(workedMinutes: number | null | undefined): AttendanceCode {
  if (!workedMinutes || workedMinutes <= 0) {
    return "A"
  }

  const workedHours = workedMinutes / 60

  // If worked duration is >= PRESENT_THRESHOLD_HOURS → Present
  if (workedHours >= PRESENT_THRESHOLD_HOURS) {
    return "P"
  }

  // Less than PRESENT_THRESHOLD_HOURS but > 0 → Half day
  return "H"
}

export function normalizeAttendanceCode(value: string | null | undefined): AttendanceCode {
  const normalized = String(value || "").trim().toUpperCase()

  if (!normalized) return "A"
  if (normalized === "FD" || normalized === "FULL DAY" || normalized === "FULLDAY") return "FD"
  if (normalized === "PD" || normalized === "PARTIAL DAY" || normalized === "PARTIALDAY") return "PD"
  if (normalized === "P" || normalized === "PRESENT") return "FD"
  if (normalized === "H" || normalized === "HALF DAY" || normalized === "HALF-DAY" || normalized === "HALFDAY") return "H"
  if (normalized === "A" || normalized === "ABSENT") return "A"
  if (normalized === "L" || normalized === "LEAVE") return "L"
  if (normalized === "IN") return "IN"
  if (normalized === "CL" || normalized === "CASUAL LEAVE") return "CL"
  if (normalized === "SL" || normalized === "SICK LEAVE") return "SL"
  if (normalized === "AL" || normalized === "ANNUAL LEAVE") return "AL"
  if (normalized === "ML" || normalized === "MEDICAL LEAVE") return "ML"
  if (normalized === "MED") return "MED"
  if (normalized === "PL" || normalized === "PRIVILEGE LEAVE") return "PL"
  if (normalized === "PLT" || normalized === "PATERNITY LEAVE") return "PLT"
  if (normalized === "CO" || normalized === "COMPENSATORY LEAVE") return "CO"
  if (normalized === "LWP" || normalized === "LEAVE WITHOUT PAY") return "LWP"
  if (normalized === "HPL" || normalized === "HALF PAY LEAVE") return "HPL"
  if (normalized === "EL" || normalized === "EARNED LEAVE") return "EL"
  if (normalized === "WO" || normalized === "WEEK OFF" || normalized === "WEEKOFF") return "WO"
  if (normalized === "PH" || normalized === "PUBLIC HOLIDAY") return "PH"

  return "A"
}

export function formatWorkedDuration(workedMinutes: number | null | undefined) {
  if (!workedMinutes || workedMinutes <= 0) {
    return "0m"
  }

  const hours = Math.floor(workedMinutes / 60)
  const minutes = workedMinutes % 60

  if (hours <= 0) {
    return `${minutes}m`
  }

  if (minutes <= 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

export function deriveNextAttendanceAction(lastRecord?: {
  checkInAt?: Date | null
  checkOutAt?: Date | null
} | null): AttendanceAction {
  if (lastRecord?.checkInAt && !lastRecord.checkOutAt) {
    return "OUT"
  }

  return "IN"
}

export function isAdminLikeDesignation(designation?: string | null) {
  const normalized = String(designation || "").trim().toLowerCase()
  return normalized.includes("admin")
}