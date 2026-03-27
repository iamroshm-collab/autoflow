export type AddressParts = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  postalCode?: string | null
}

type ParsedAddressParts = {
  line1: string
  line2: string
  city: string
  district: string
  state: string
  postalCode: string
}

const clean = (value: string | null | undefined) => String(value || "").trim()

export function composeAddress(parts: AddressParts, options?: { includeState?: boolean }) {
  const includeState = options?.includeState !== false
  const values = [
    clean(parts.line1),
    clean(parts.line2),
    clean(parts.city),
    clean(parts.district),
    includeState ? clean(parts.state) : "",
    clean(parts.postalCode),
  ].filter(Boolean)

  return values.join(", ")
}

export function parseAddress(address: string | null | undefined): ParsedAddressParts {
  const chunks = String(address || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  // 6+ parts → composed with district: line1, line2, city, district, state, postalCode
  if (chunks.length >= 6) {
    return {
      line1: chunks[0] || "",
      line2: chunks[1] || "",
      city: chunks[2] || "",
      district: chunks[3] || "",
      state: chunks[4] || "",
      postalCode: chunks[5] || "",
    }
  }

  // 5 or fewer parts → composed without district: line1, line2, city, state, postalCode
  return {
    line1: chunks[0] || "",
    line2: chunks[1] || "",
    city: chunks[2] || "",
    district: "",
    state: chunks[3] || "",
    postalCode: chunks[4] || "",
  }
}
