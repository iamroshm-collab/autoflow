"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getOrCreateDeviceId } from "@/lib/device-identity"
import { normalizeMobileNumber } from "@/lib/mobile-validation"

export default function AdminLoginPage() {
  const router = useRouter()
  const [mobile, setMobile] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Redirect already-authenticated sessions immediately
  useEffect(() => {
    let active = true
    const bootstrap = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (response.ok && active) {
          router.replace("/")
        }
      } catch {
        // not authenticated — stay on page
      }
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [router])

  const applyUserSession = (data: { user?: { role?: string; employeeRefId?: number | null } }) => {
    if (typeof window !== "undefined" && data?.user) {
      localStorage.setItem("gms_user_role", String(data.user.role || ""))
      if (data.user.employeeRefId) {
        localStorage.setItem("gms_employee_id", String(data.user.employeeRefId))
      } else {
        localStorage.removeItem("gms_employee_id")
      }
    }
    router.replace("/")
  }

  const requestLogin = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    const normalizedMobile = normalizeMobileNumber(mobile)
    const deviceId = getOrCreateDeviceId()

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mobile: normalizedMobile, deviceId }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // If not an admin, show warning and then redirect to registration with mobile prefilled.
        if (data?.error?.includes("admin") || data?.error?.includes("not found") || data?.error?.includes("not authorized")) {
          setError("This mobile number is not an admin account. Redirecting to registration.")
          setTimeout(() => {
            router.push(`/register?mobile=${encodeURIComponent(normalizedMobile)}`)
          }, 1400)
          return
        }
        setError(String(data?.error || "Login failed. Please try again."))
        return
      }

      if (data.success) {
        // Trusted device — session issued immediately
        applyUserSession(data)
        return
      }

      if (data.otpSent) {
        setOtpSent(true)
        setMessage("OTP sent to your WhatsApp number. Enter it below to login.")
      }
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    const deviceId = getOrCreateDeviceId()

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mobile: normalizeMobileNumber(mobile), deviceId, otp }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(String(data?.error || "OTP verification failed. Please try again."))
        return
      }

      if (data.success) {
        applyUserSession(data)
      }
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  const backToMobile = () => {
    setOtpSent(false)
    setOtp("")
    setError("")
    setMessage("")
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AutoFlow</p>
          <h1 className="text-2xl font-semibold text-slate-950">Admin Login</h1>
          <p className="text-sm text-slate-500">
            If you are not the admin of the app please register through the below link.
          </p>
        </div>

        {!otpSent ? (
          <div className="space-y-2">
            <Label htmlFor="mobile">Admin Mobile Number</Label>
            <Input
              id="mobile"
              value={mobile}
              onChange={(event) => setMobile(normalizeMobileNumber(event.target.value))}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit WhatsApp number"
              disabled={loading}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
              OTP sent to <span className="font-medium text-slate-900">{mobile}</span>
              <button
                type="button"
                onClick={backToMobile}
                className="ml-2 text-sky-700 hover:text-sky-800 text-xs underline"
              >
                Change
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp">WhatsApp OTP</Label>
              <Input
                id="otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        {!otpSent ? (
          <Button
            type="button"
            onClick={requestLogin}
            disabled={loading || mobile.length !== 10}
            className="w-full"
          >
            {loading ? "Checking..." : "Send OTP"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              type="button"
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full"
            >
              {loading ? "Verifying..." : "Verify OTP & Login"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={requestLogin}
              disabled={loading}
              className="w-full"
            >
              Resend OTP
            </Button>
          </div>
        )}

        <p className="text-sm text-slate-500 text-center">
          <Link href="/register" className="text-sky-700 hover:text-sky-800">
            Register here
          </Link>
        </p>
      </div>
    </main>
  )
}
