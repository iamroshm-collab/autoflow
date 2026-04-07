import crypto from "crypto"

interface PendingToken {
  employeeId: number
  expiresAt: number
  imagePath: string
  avgScore: number
  verifiedAt: number
}

const tokens = new Map<string, PendingToken>()

export function issueToken(employeeId: number, imagePath: string, avgScore: number, ttlMs = Number(process.env.CORRECTION_TOKEN_TTL_MS ?? 300000)) {
  const token = crypto.randomUUID()
  const now = Date.now()
  tokens.set(token, { employeeId, expiresAt: now + ttlMs, imagePath, avgScore, verifiedAt: now })
  return token
}

export function consumeToken(token: string, employeeId: number) {
  const pending = tokens.get(token)
  if (!pending) return null
  if (pending.employeeId !== employeeId) return null
  if (Date.now() > pending.expiresAt) {
    tokens.delete(token)
    return null
  }
  tokens.delete(token)
  return pending
}

export function purgeExpired() {
  const now = Date.now()
  for (const [k, v] of tokens.entries()) {
    if (v.expiresAt < now) tokens.delete(k)
  }
}
