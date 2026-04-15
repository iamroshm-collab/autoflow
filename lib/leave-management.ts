import { parseISODateToLocalDate } from "@/lib/utils"

const INDIA_OFFSET_MINUTES = 5 * 60 + 30

export const normalizeLeaveStatus = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "approved" || normalized === "rejected" || normalized === "pending") {
    return normalized
  }
  return "pending"
}

export const calculateLeaveDaysInclusive = (startDate: string, endDate: string) => {
  const start = parseISODateToLocalDate(startDate)
  const end = parseISODateToLocalDate(endDate)
  if (!start || !end) return null
  if (end < start) return null

  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1
  return diffDays
}

export const toIndiaDayStart = (dateIso: string) => {
  const date = parseISODateToLocalDate(dateIso)
  if (!date) return null

  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const utcTimestamp = Date.UTC(year, month, day, 0, 0, 0, 0) - INDIA_OFFSET_MINUTES * 60 * 1000
  return new Date(utcTimestamp)
}

export const enumerateISODateRange = (startDate: string, endDate: string) => {
  const start = parseISODateToLocalDate(startDate)
  const end = parseISODateToLocalDate(endDate)
  if (!start || !end || end < start) {
    return []
  }

  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const yyyy = cursor.getFullYear()
    const mm = String(cursor.getMonth() + 1).padStart(2, "0")
    const dd = String(cursor.getDate()).padStart(2, "0")
    dates.push(`${yyyy}-${mm}-${dd}`)
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export const clampPercentage = (value: unknown, fallback = 100) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(100, parsed))
}

export const normalizeGenderRestriction = (value: unknown) => {
  const normalized = String(value || "none").trim().toLowerCase()
  if (normalized === "male" || normalized === "female" || normalized === "none") {
    return normalized
  }
  return "none"
}
