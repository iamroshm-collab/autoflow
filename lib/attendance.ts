const EARTH_RADIUS_METERS = 6371000

export type AttendanceAction = "IN" | "OUT"
export type AttendanceCode = "P" | "H" | "A" | "L" | "IN"

export function toDayStart(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function toNextDay(value: Date | string) {
  const nextDay = toDayStart(value)
  nextDay.setDate(nextDay.getDate() + 1)
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

  if (!normalized) {
    return "A"
  }

  if (normalized === "P" || normalized === "PRESENT") {
    return "P"
  }

  if (
    normalized === "H" ||
    normalized === "HALF DAY" ||
    normalized === "HALF-DAY" ||
    normalized === "HALFDAY"
  ) {
    return "H"
  }

  if (normalized === "A" || normalized === "ABSENT") {
    return "A"
  }

  if (normalized === "L" || normalized === "LEAVE") {
    return "L"
  }

  if (normalized === "IN") {
    return "IN"
  }

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