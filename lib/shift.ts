import { getTodayISODateInIndia } from "./utils"

function parseHHMM(str: string): { hour: number; minute: number } | null {
  const m = String(str).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function getIndiaMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return hour * 60 + minute
}

export function evaluateCheckIn(checkInAt: Date, shiftStart: string, graceMins: number): { status: "On Time" | "Late"; lateMinutes: number } {
  const parsed = parseHHMM(shiftStart)
  if (!parsed) {
    return { status: "On Time", lateMinutes: 0 }
  }

  const shiftMinutes = parsed.hour * 60 + parsed.minute
  const checkInMinutes = getIndiaMinutesOfDay(checkInAt)

  const late = Math.max(0, checkInMinutes - shiftMinutes - graceMins)
  if (checkInMinutes <= shiftMinutes + graceMins) {
    return { status: "On Time", lateMinutes: 0 }
  }
  return { status: "Late", lateMinutes: late }
}

export function evaluateCheckOut(checkOutAt: Date, shiftEnd: string, overtimeThresholdMins: number): { status: "On Time" | "Early Leave" | "Overtime" } {
  const parsed = parseHHMM(shiftEnd)
  if (!parsed) {
    return { status: "On Time" }
  }

  const shiftMinutes = parsed.hour * 60 + parsed.minute
  const checkOutMinutes = getIndiaMinutesOfDay(checkOutAt)

  if (checkOutMinutes < shiftMinutes) {
    return { status: "Early Leave" }
  }

  if (checkOutMinutes - shiftMinutes >= overtimeThresholdMins) {
    return { status: "Overtime" }
  }

  return { status: "On Time" }
}
