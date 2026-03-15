import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ISO_DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }

  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/**
 * Format a Date as YYYY-MM-DD using local calendar date parts (no UTC conversion).
 */
export function formatDateToISODate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Parse YYYY-MM-DD into a local Date (midnight local time), avoiding UTC shifts.
 */
export function parseISODateToLocalDate(value: string): Date | null {
  const trimmed = value.trim()
  const match = trimmed.match(ISO_DATE_ONLY_REGEX)
  if (!match) {
    return null
  }

  const [, yyyy, mm, dd] = match
  const year = Number(yyyy)
  const month = Number(mm)
  const day = Number(dd)

  if (!isValidDateParts(year, month, day)) {
    return null
  }

  return new Date(year, month - 1, day)
}

/**
 * Get today's date in Asia/Kolkata as YYYY-MM-DD.
 */
export function getTodayISODateInIndia(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (year && month && day) {
    return `${year}-${month}-${day}`
  }

  return formatDateToISODate(now)
}

/**
 * Convert string to uppercase
 */
export function toUpperCase(value: string): string {
  if (!value) return ""
  return value.toUpperCase()
}

/**
 * Convert string to proper case
 * Single word: capitalize first letter (e.g., "regency" -> "Regency")
 * Multiple words: capitalize only first letter of first word, rest lowercase
 * (e.g., "wiper blade" -> "Wiper blade", "ac filter" -> "Ac filter")
 */
export function toProperCase(value: string): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (trimmed.length === 0) return ""
  
  // Split by space to check if it's single or multiple words
  const words = trimmed.split(/\s+/)
  
  if (words.length === 1) {
    // Single word: capitalize first letter, rest lowercase
    return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
  } else {
    // Multiple words: capitalize only first letter of first word, rest lowercase
    const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
    const restWords = words.slice(1).map(w => w.toLowerCase()).join(" ")
    return firstWord + " " + restWords
  }
}

/**
 * Fields that should always be uppercase
 */
const UPPERCASE_FIELDS = [
  "registrationNumber",
  "registrationNo",
  "registration",
  "vehicleRegistration",
  "pan",
  "gstin",
  "gst",
  "billNumber",
  "billNo",
  "invoiceNumber",
  "invoiceNo",
  "id",
  "number",
  "code",
  "partNumber",
  "sku",
]

/**
 * Convert text based on field name.
 * Fields with registration, PAN, GSTIN, GST, Bill Number, or id -> UPPERCASE
 * All other text fields -> Proper Case (Title Case)
 */
export function formatTextByField(value: string, fieldName?: string): string {
  if (!value) return ""
  
  if (fieldName) {
    const lowerFieldName = fieldName.toLowerCase()
    const shouldBeUppercase = UPPERCASE_FIELDS.some(field => 
      lowerFieldName.includes(field)
    )
    
    if (shouldBeUppercase) {
      return toUpperCase(value)
    }
  }
  
  return toProperCase(value)
}

/**
 * Safely convert a value to a finite number.
 * - Accepts numbers or numeric strings (with commas, whitespace)
 * - Returns 0 for non-numeric values
 */
export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (value == null) return 0
  const cleaned = String(value).replace(/,/g, "").trim()
  if (cleaned === "") return 0
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

/**
 * Format a date to dd-mm-yy format
 * Accepts ISO dates (YYYY-MM-DD), Date objects, or timestamp strings
 */
export function formatDateDDMMYY(value?: string | Date | null): string {
  if (!value) {
    return ""
  }

  const date =
    typeof value === "string"
      ? parseISODateToLocalDate(value) || new Date(value)
      : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = String(date.getFullYear()).slice(-2)

  return `${day}-${month}-${year}`
}

/**
 * Parse dd-mm-yy format to ISO format (YYYY-MM-DD)
 * Returns empty string if invalid
 */
export function parseDDMMYYToISO(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (!match) {
    return ""
  }

  const [, dd, mm, yy] = match
  const day = Number(dd)
  const month = Number(mm)
  const year = 2000 + Number(yy)

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return ""
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return ""
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
