"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authService, AuthServiceError } from "@/services/authService"
import { getOrCreateDeviceId } from "@/lib/device-identity"
import { normalizeMobileNumber } from "@/lib/mobile-validation"

const PENDING_LOGIN_MOBILE_KEY = "autoflow_pending_login_mobile"

type Mode =
  | "employee"          // normal employee login / waiting for device approval
  | "admin_otp_pending" // admin: OTP not yet entered
  | "admin_otp_sent"    // admin: OTP sent, waiting for input
  | "deregister_prompt" // lost-device: show de-register panel
  | "deregister_otp"    // lost-device: OTP input to confirm de-registration

export default function LoginPage() {
  const router = useRouter()
  const [mobile, setMobile] = useState("")
  const [mode, setMode] = useState<Mode>("employee")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [waitingForApproval, setWaitingForApproval] = useState(false)

  // Admin OTP
  const [adminOtp, setAdminOtp] = useState("")

  // De-register (lost device) OTP
  const [deregOtp, setDeregOtp] = useState("")
  const [deregLoading, setDeregLoading] = useState(false)
  const [deregError, setDeregError] = useState("")
  const [deregMessage, setDeregMessage] = useState("")

  const approvalPollingRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)
  const pollInProgressRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // ── helpers ──────────────────────────────────────────────────────────────────

  const clearPendingLogin = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_LOGIN_MOBILE_KEY)
    if (isMountedRef.current) setWaitingForApproval(false)
  }

  const storePendingLogin = (value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(PENDING_LOGIN_MOBILE_KEY, value)
    if (isMountedRef.current) setWaitingForApproval(true)
  }

  const applyUserSession = (data: any) => {
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

  const resetToMobileEntry = () => {
    setMode("employee")
    setAdminOtp("")
    setDeregOtp("")
    setError("")
    setMessage("")
    setDeregError("")
    setDeregMessage("")
  }

  // ── employee device-approval polling ─────────────────────────────────────────

  const tryResumeApprovedLogin = async (mobileNumber: string) => {
    if (pollInProgressRef.current) return false
    pollInProgressRef.current = true

    const normalizedMobile = normalizeMobileNumber(mobileNumber)
    if (normalizedMobile.length !== 10) {
      clearPendingLogin()
      pollInProgressRef.current = false
      return false
    }

    try {
      const data = await authService.resumeApprovedDeviceLogin(normalizedMobile)
      if (!isMountedRef.current) { pollInProgressRef.current = false; return true }
      clearPendingLogin()
      setMobile(normalizedMobile)
      setError("")
      setMessage("Your device has been approved. Signing you in now.")
      pollInProgressRef.current = false
      applyUserSession(data)
      return true
    } catch (submitError) {
      pollInProgressRef.current = false
      if (!isMountedRef.current) return false
      if (submitError instanceof AuthServiceError && submitError.status === 403) {
        if (isMountedRef.current) {
          setWaitingForApproval(true)
          setMessage("Your login request is pending admin approval. Stay on this device and you will be signed in automatically once approved.")
        }
        return false
      }
      clearPendingLogin()
      if (isMountedRef.current) {
        setError(submitError instanceof AuthServiceError ? submitError.message : "Login failed")
      }
      return false
    }
  }

  // Bootstrap: check existing session or stored pending mobile
  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (response.ok) {
          const data = await response.json()
          if (!active) return
          clearPendingLogin()
          applyUserSession(data)
          return
        }
      } catch {}

      if (typeof window === "undefined" || !active) return

      const pendingMobile = normalizeMobileNumber(window.localStorage.getItem(PENDING_LOGIN_MOBILE_KEY) || "")
      if (pendingMobile.length === 10) {
        if (isMountedRef.current) {
          setMobile(pendingMobile)
          setError("")
          setWaitingForApproval(true)
          setMessage("Your login request is pending admin approval. Stay on this device and you will be signed in automatically once approved.")
        }
        void tryResumeApprovedLogin(pendingMobile)
      }
    }

    void bootstrap()
    return () => { active = false }
  }, [router])

  // Polling interval for device approval
  useEffect(() => {
    if (!waitingForApproval) {
      if (approvalPollingRef.current !== null) {
        window.clearInterval(approvalPollingRef.current)
        approvalPollingRef.current = null
      }
      return
    }

    const poll = () => {
      if (typeof window === "undefined") return
      const pendingMobile = normalizeMobileNumber(window.localStorage.getItem(PENDING_LOGIN_MOBILE_KEY) || mobile)
      if (pendingMobile.length === 10) void tryResumeApprovedLogin(pendingMobile)
    }

    approvalPollingRef.current = window.setInterval(poll, 8000)
    return () => {
      if (approvalPollingRef.current !== null) {
        window.clearInterval(approvalPollingRef.current)
        approvalPollingRef.current = null
      }
    }
  }, [mobile, waitingForApproval])

  // ── admin OTP flow ────────────────────────────────────────────────────────────

  const requestAdminOtp = async (mobileNumber: string) => {
    setLoading(true)
    setError("")
    setMessage("")
    const deviceId = getOrCreateDeviceId()
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobileNumber, deviceId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(String(data?.error || "Failed to initiate admin login"))
        setMode("employee")
        return
      }
      if (data.success) {
        // Trusted device — session issued immediately
        applyUserSession(data)
        return
      }
      if (data.otpSent) {
        setMode("admin_otp_sent")
        setMessage("OTP sent to your WhatsApp. Enter it below to login.")
      }
    } catch {
      setError("Network error. Please try again.")
      setMode("employee")
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  const verifyAdminOtp = async () => {
    setLoading(true)
    setError("")
    setMessage("")
    const deviceId = getOrCreateDeviceId()
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: normalizeMobileNumber(mobile), deviceId, otp: adminOtp }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(String(data?.error || "OTP verification failed"))
        return
      }
      if (data.success) applyUserSession(data)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  // ── employee login ────────────────────────────────────────────────────────────

  const requestLogin = async () => {
    setLoading(true)
    setError("")
    setMessage("")
    setMode("employee")

    const normalizedMobile = normalizeMobileNumber(mobile)

    const redirectToRegistration = (value: string, warningText: string) => {
      setError(warningText)
      setTimeout(() => router.push(`/register?mobile=${encodeURIComponent(value)}`), 1400)
    }

    if (typeof window !== "undefined") {
      const pendingMobile = normalizeMobileNumber(window.localStorage.getItem(PENDING_LOGIN_MOBILE_KEY) || "")
      if (pendingMobile.length === 10 && pendingMobile !== normalizedMobile) {
        clearPendingLogin()
        redirectToRegistration(normalizedMobile, "This mobile is different from your pending login request. Redirecting to registration.")
        setLoading(false)
        return
      }
    }

    try {
      // Probe admin-login first: if this mobile is configured as ADMIN_MOBILE,
      // the admin-login route will either issue a trusted session or send an OTP.
      const deviceId = getOrCreateDeviceId()
      try {
        const adminRes = await fetch("/api/auth/admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile: normalizedMobile, deviceId }),
        })
        const adminData = await adminRes.json().catch(() => ({}))
        if (adminRes.ok) {
          // admin flow handled (trusted device or OTP sent)
          if (adminData.success) {
            clearPendingLogin()
            applyUserSession(adminData)
            return
          }
          if (adminData.otpSent) {
            setMode("admin_otp_sent")
            setMessage("OTP sent to your WhatsApp. Enter it below to login.")
            return
          }
        }
      } catch (probeErr) {
        // ignore and continue to normal employee login
      }

      const data = await authService.requestApprovedDeviceLogin(normalizedMobile)
      clearPendingLogin()
      setMessage("Signed in successfully.")
      applyUserSession(data)
    } catch (submitError) {
      if (submitError instanceof AuthServiceError) {
        const responseData = submitError.data || {}

        // ── Admin mobile detected — switch to admin OTP flow ──
        if (submitError.status === 403 && responseData.isAdmin) {
          setLoading(false)
          setMode("admin_otp_pending")
          void requestAdminOtp(normalizedMobile)
          return
        }

        const msg = submitError.message || ""
        const isDevicePending =
          submitError.status === 403 &&
          (msg.toLowerCase().includes("device") || msg.toLowerCase().includes("approval"))

        if (isDevicePending) {
          storePendingLogin(normalizedMobile)
          setError("")
          setMessage("Your login request is pending admin approval. Stay on this device and you will be signed in automatically once approved.")
          if (responseData.hasExistingDevice) setMode("deregister_prompt")
        } else if (submitError.status === 404) {
          redirectToRegistration(normalizedMobile, "This mobile number is not registered. Redirecting to registration.")
        } else {
          setError(msg || "Login failed")
        }
      } else {
        setError("Login failed. Please try again.")
      }
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  // ── de-register (lost device) flow ───────────────────────────────────────────

  const sendDeregOtp = async () => {
    setDeregLoading(true)
    setDeregError("")
    setDeregMessage("")
    try {
      const res = await fetch("/api/auth/deregister-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: normalizeMobileNumber(mobile) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send OTP")
      setMode("deregister_otp")
      setDeregMessage("OTP sent to your WhatsApp. Enter it below to confirm de-registration.")
    } catch (err) {
      setDeregError(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setDeregLoading(false)
    }
  }

  const verifyDeregOtp = async () => {
    setDeregLoading(true)
    setDeregError("")
    setDeregMessage("")
    try {
      const res = await fetch("/api/auth/deregister-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: normalizeMobileNumber(mobile), otp: deregOtp, verifyOtp: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "OTP verification failed")
      setDeregOtp("")
      setMode("employee")
      setDeregMessage("")
      setMessage("Old device removed. Submitting your login request now...")
      setTimeout(() => { if (isMountedRef.current) void requestLogin() }, 1200)
    } catch (err) {
      setDeregError(err instanceof Error ? err.message : "OTP verification failed")
    } finally {
      setDeregLoading(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────────

  const isAdminMode = mode === "admin_otp_pending" || mode === "admin_otp_sent"

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AutoFlow</p>
          <h1 className="text-2xl font-semibold text-slate-950">
            {isAdminMode ? "Admin Login" : "Login"}
          </h1>
          <p className="text-sm text-slate-500">
            {isAdminMode
              ? "Admin account detected. Verify via WhatsApp OTP."
              : "Enter your registered mobile number to login."}
          </p>
        </div>

        {/* Mobile input — shown unless we're past the OTP step */}
        {mode !== "admin_otp_sent" && (
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile Number</Label>
            <Input
              id="mobile"
              value={mobile}
              onChange={(e) => {
                const next = normalizeMobileNumber(e.target.value)
                setMobile(next)
                if (waitingForApproval) { clearPendingLogin(); setMessage("") }
                resetToMobileEntry()
              }}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              disabled={loading || waitingForApproval || deregLoading || isAdminMode}
            />
          </div>
        )}

        {/* Admin OTP sent — show context + OTP input */}
        {mode === "admin_otp_sent" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
              OTP sent to <span className="font-medium text-slate-900">{mobile}</span>
              <button
                type="button"
                onClick={() => { resetToMobileEntry(); setWaitingForApproval(false) }}
                className="ml-2 text-sky-700 hover:text-sky-800 text-xs underline"
              >
                Change
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-otp">WhatsApp OTP</Label>
              <Input
                id="admin-otp"
                value={adminOtp}
                onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
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

        {/* Main action button */}
        {mode === "employee" && (
          <Button
            type="button"
            onClick={requestLogin}
            disabled={loading || waitingForApproval || mobile.length !== 10}
            className="w-full"
          >
            {loading ? "Signing in..." : waitingForApproval ? "Waiting for Approval..." : "Login"}
          </Button>
        )}

        {mode === "admin_otp_pending" && (
          <Button type="button" disabled className="w-full">
            Sending OTP...
          </Button>
        )}

        {mode === "admin_otp_sent" && (
          <div className="space-y-2">
            <Button
              type="button"
              onClick={verifyAdminOtp}
              disabled={loading || adminOtp.length !== 6}
              className="w-full"
            >
              {loading ? "Verifying..." : "Verify OTP & Login"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => requestAdminOtp(normalizeMobileNumber(mobile))}
              disabled={loading}
              className="w-full"
            >
              Resend OTP
            </Button>
          </div>
        )}

        {/* Lost device — de-register prompt */}
        {mode === "deregister_prompt" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-900">Lost access to your old device?</p>
            <p className="text-xs text-amber-700">
              Verify your identity via WhatsApp OTP to de-register the old device. Your account data stays intact and a fresh device approval request will be sent to admin.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={sendDeregOtp}
              disabled={deregLoading}
              className="w-full border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              {deregLoading ? "Sending OTP..." : "De-register old device"}
            </Button>
            {deregError ? <p className="text-xs text-rose-600">{deregError}</p> : null}
          </div>
        )}

        {/* Lost device — OTP entry */}
        {mode === "deregister_otp" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-900">Enter WhatsApp OTP</p>
            <p className="text-xs text-amber-700">{deregMessage}</p>
            <Input
              value={deregOtp}
              onChange={(e) => setDeregOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit OTP"
              disabled={deregLoading}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={verifyDeregOtp}
                disabled={deregLoading || deregOtp.length !== 6}
                className="flex-1"
              >
                {deregLoading ? "Verifying..." : "Confirm de-registration"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={sendDeregOtp}
                disabled={deregLoading}
                className="flex-1"
              >
                Resend OTP
              </Button>
            </div>
            {deregError ? <p className="text-xs text-rose-600">{deregError}</p> : null}
          </div>
        )}

        <p className="text-sm text-slate-500 text-center">
          Need an account?{" "}
          <Link href="/register" className="text-sky-700 hover:text-sky-800">Register here</Link>
        </p>
      </div>
    </main>
  )
}
