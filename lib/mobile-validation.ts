export const MOBILE_DIGIT_COUNT = 10

export const normalizeMobileNumber = (value: unknown): string => {
  return String(value ?? "").replace(/\D/g, "").slice(0, MOBILE_DIGIT_COUNT)
}

export const isValidMobileNumber = (value: unknown): boolean => {
  const normalized = normalizeMobileNumber(value)
  return normalized.length === MOBILE_DIGIT_COUNT
}

export const getMobileValidationMessage = (
  value: unknown,
  label = "Mobile number",
  required = true
): string | null => {
  const normalized = normalizeMobileNumber(value)

  if (!normalized) {
    return required ? `${label} is required` : null
  }

  if (normalized.length !== MOBILE_DIGIT_COUNT) {
    return `${label} must be exactly 10 digits`
  }

  return null
}
