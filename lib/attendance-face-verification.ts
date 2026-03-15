const FACE_VERIFICATION_MODE = String(process.env.ATTENDANCE_FACE_VERIFICATION_MODE || "not_configured")
  .trim()
  .toLowerCase()

export interface AttendanceVerificationInput {
  employeeId: number
  action: "IN" | "OUT"
  referenceImageUrl: string
  videoUrl: string
  clientVerification?: {
    provider?: string
    status?: string
    score?: number | null
    distance?: number | null
  } | null
}

export interface AttendanceVerificationResult {
  passed: boolean
  provider: string
  status: string
  score: number | null
  reason?: string
}

function toOptionalNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function verifyWithFaceApiClientSignal(
  payload: AttendanceVerificationInput
): AttendanceVerificationResult {
  const maxDistance = Number(process.env.ATTENDANCE_FACE_API_MAX_DISTANCE || 0.55)
  const provider = String(payload.clientVerification?.provider || "face-api.js")
  const status = String(payload.clientVerification?.status || "missing")
  const score = toOptionalNumber(payload.clientVerification?.score)
  const distance = toOptionalNumber(payload.clientVerification?.distance)

  if (!payload.clientVerification) {
    return {
      passed: false,
      provider,
      status: "missing",
      score: null,
      reason: "Client face verification data is missing.",
    }
  }

  if (status !== "verified") {
    return {
      passed: false,
      provider,
      status,
      score,
      reason: "Face verification failed on client.",
    }
  }

  if (distance != null && distance > maxDistance) {
    return {
      passed: false,
      provider,
      status: "below_threshold",
      score,
      reason: `Face verification distance ${distance} is above maximum allowed ${maxDistance}.`,
    }
  }

  if (distance == null && score == null) {
    return {
      passed: false,
      provider,
      status: "missing_score",
      score,
      reason: "Client verification did not provide score or distance.",
    }
  }

  return {
    passed: true,
    provider,
    status: "verified",
    score,
  }
}

async function verifyWithRemoteHttpProvider(
  payload: AttendanceVerificationInput
): Promise<AttendanceVerificationResult> {
  const endpoint = String(process.env.ATTENDANCE_FACE_VERIFICATION_URL || "").trim()
  if (!endpoint) {
    return {
      passed: false,
      provider: "remote_http",
      status: "provider_not_configured",
      score: null,
      reason: "Set ATTENDANCE_FACE_VERIFICATION_URL before enabling remote face verification.",
    }
  }

  const apiKey = String(process.env.ATTENDANCE_FACE_VERIFICATION_API_KEY || "").trim()
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  let data: Record<string, unknown> = {}
  try {
    data = (await response.json()) as Record<string, unknown>
  } catch {
    data = {}
  }

  const matched = data.matched === true || data.passed === true || data.verified === true
  const provider = String(data.provider || "remote_http")
  const status = String(data.status || (matched ? "verified" : "rejected"))
  const reason = String(data.reason || data.error || "Face verification failed")
  const score = toOptionalNumber(data.score)

  if (!response.ok) {
    return {
      passed: false,
      provider,
      status,
      score,
      reason,
    }
  }

  return {
    passed: matched,
    provider,
    status,
    score,
    reason: matched ? undefined : reason,
  }
}

export function getAttendanceFaceVerificationMode() {
  return FACE_VERIFICATION_MODE || "not_configured"
}

export async function verifyAttendanceEvidence(
  payload: AttendanceVerificationInput
): Promise<AttendanceVerificationResult> {
  if (FACE_VERIFICATION_MODE === "development_bypass") {
    return {
      passed: true,
      provider: "development_bypass",
      status: "verified",
      score: 1,
    }
  }

  if (FACE_VERIFICATION_MODE === "remote_http") {
    return verifyWithRemoteHttpProvider(payload)
  }

  if (FACE_VERIFICATION_MODE === "face_api_js_client") {
    return verifyWithFaceApiClientSignal(payload)
  }

  return {
    passed: false,
    provider: FACE_VERIFICATION_MODE || "not_configured",
    status: "provider_required",
    score: null,
    reason: "Configure ATTENDANCE_FACE_VERIFICATION_MODE and provider settings before enabling production attendance verification.",
  }
}