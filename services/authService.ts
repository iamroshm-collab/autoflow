import { getOrCreateDeviceId } from "@/lib/device-identity"

export class AuthServiceError extends Error {
  status: number
  data: Record<string, unknown>

  constructor(message: string, status = 500, data: Record<string, unknown> = {}) {
    super(message)
    this.name = "AuthServiceError"
    this.status = status
    this.data = data
  }
}

const readJson = async (response: Response) => {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new AuthServiceError(String(data?.error || "Request failed"), response.status, data)
  }

  return data
}

export const authService = {
  async register(input: {
    name: string
    aadhar?: string
    address: string
    mobile: string
    role?: string
  }) {
    const deviceId = getOrCreateDeviceId()
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        deviceId,
      }),
    })

    return readJson(response)
  },

  async verifyRegisterOtp(mobile: string, otp: string) {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile,
        otp,
        verifyOtpOnly: true,
      }),
    })

    return readJson(response)
  },

  async requestApprovedDeviceLogin(mobile: string) {
    const deviceId = getOrCreateDeviceId()
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, deviceId, resumeApprovedDevice: true }),
    })

    return readJson(response)
  },

  async resumeApprovedDeviceLogin(mobile: string) {
    const deviceId = getOrCreateDeviceId()
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, deviceId, resumeApprovedDevice: true }),
    })

    return readJson(response)
  },

  async logout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
    })

    return readJson(response)
  },
}
