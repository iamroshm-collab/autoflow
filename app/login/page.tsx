"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authService, AuthServiceError } from "@/services/authService"
import { normalizeMobileNumber } from "@/lib/mobile-validation"

const PENDING_LOGIN_MOBILE_KEY = "autoflow_pending_login_mobile"

export default function LoginPage() {
  const router = useRouter()
  const [mobile, setMobile] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [waitingForApproval, setWaitingForApproval] = useState(false)
  const approvalPollingRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)
  const pollInProgressRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const clearPendingLogin = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PENDING_LOGIN_MOBILE_KEY)
    }
    if (isMountedRef.current) {
      setWaitingForApproval(false)
    }
  }

  const storePendingLogin = (value: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PENDING_LOGIN_MOBILE_KEY, value)
    }
    if (isMountedRef.current) {
      setWaitingForApproval(true)
    }
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

  const tryResumeApprovedLogin = async (mobileNumber: string) => {
    if (pollInProgressRef.current) {
      return false
    }
    pollInProgressRef.current = true

    const normalizedMobile = normalizeMobileNumber(mobileNumber)
    if (normalizedMobile.length !== 10) {
      clearPendingLogin()
      pollInProgressRef.current = false
      return false
    }

    try {
      const data = await authService.resumeApprovedDeviceLogin(normalizedMobile)
      if (!isMountedRef.current) {
        pollInProgressRef.current = false
        return true
      }
      clearPendingLogin()
      setMobile(normalizedMobile)
      setError("")
      setMessage("Your device has been approved. Signing you in now.")
      pollInProgressRef.current = false
      applyUserSession(data)
      return true
    } catch (submitError) {
      pollInProgressRef.current = false
      if (!isMountedRef.current) {
        return false
      }
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

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (response.ok) {
          const data = await response.json()
          if (!active) {
            return
          }
          clearPendingLogin()
          applyUserSession(data)
          return
        }
      } catch {
      }

      if (typeof window === "undefined" || !active) {
        return
      }

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

    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    if (!waitingForApproval) {
      if (approvalPollingRef.current !== null) {
        window.clearInterval(approvalPollingRef.current)
        approvalPollingRef.current = null
      }
      return
    }

    const poll = () => {
      if (typeof window === "undefined") {
        return
      }

      const pendingMobile = normalizeMobileNumber(window.localStorage.getItem(PENDING_LOGIN_MOBILE_KEY) || mobile)
      if (pendingMobile.length === 10) {
        void tryResumeApprovedLogin(pendingMobile)
      }
    }

    approvalPollingRef.current = window.setInterval(poll, 8000)
    return () => {
      if (approvalPollingRef.current !== null) {
        window.clearInterval(approvalPollingRef.current)
        approvalPollingRef.current = null
      }
    }
  }, [mobile, waitingForApproval])

  const requestLogin = async () => {
    setLoading(true)
    setError("")
    setMessage("")

    const normalizedMobile = normalizeMobileNumber(mobile)

    const redirectToRegistration = (value: string, warningText: string) => {
      setError(warningText)
      setTimeout(() => {
        router.push(`/register?mobile=${encodeURIComponent(value)}`)
      }, 1400)
    }

    if (typeof window !== "undefined") {
      const pendingMobile = normalizeMobileNumber(window.localStorage.getItem(PENDING_LOGIN_MOBILE_KEY) || "")
      if (pendingMobile.length === 10 && pendingMobile !== normalizedMobile) {
        clearPendingLogin()
        redirectToRegistration(
          normalizedMobile,
          "This mobile is different from your pending login request. Redirecting to registration."
        )
        setLoading(false)
        return
      }
    }

    try {
      const data = await authService.requestApprovedDeviceLogin(normalizedMobile)
      clearPendingLogin()
      setMessage("Signed in successfully.")
      applyUserSession(data)
    } catch (submitError) {
      if (submitError instanceof AuthServiceError) {
        const msg = submitError.message || ""
        const isDevicePending =
          submitError.status === 403 &&
          (msg.toLowerCase().includes("device") || msg.toLowerCase().includes("approval"))
        const isAdminOnly =
          submitError.status === 403 &&
          msg.toLowerCase().includes("admin")

        if (isAdminOnly) {
          // Mobile belongs to an admin — direct them to the admin login page
          setError("This number is registered as an admin account. Please use the admin login page.")
        } else if (isDevicePending) {
          storePendingLogin(normalizedMobile)
          setError("")
          setMessage("Your login request is pending admin approval. Stay on this device and you will be signed in automatically once approved.")
        } else if (submitError.status === 404) {
          redirectToRegistration(
            normalizedMobile,
            "This mobile number is not registered. Redirecting to registration."
          )
        } else {
          setError(msg || "Login failed")
        }
      } else {
        setError("Login failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AutoFlow</p>
          <h1 className="text-2xl font-semibold text-slate-950">Employee Login</h1>
          <p className="text-sm text-slate-500">Use your approved mobile number to enter from your approved device.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            value={mobile}
            onChange={(event) => {
              const nextMobile = normalizeMobileNumber(event.target.value)
              setMobile(nextMobile)
              if (waitingForApproval) {
                clearPendingLogin()
                setMessage("")
              }
            }}
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            disabled={loading || waitingForApproval}
          />
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <Button type="button" onClick={requestLogin} disabled={loading || waitingForApproval || mobile.length !== 10} className="w-full">
          {loading ? "Signing in..." : waitingForApproval ? "Waiting for Approval..." : "Login"}
        </Button>

        <p className="text-sm text-slate-500 text-center">
          Need an account?{" "}
          <Link href="/register" className="text-sky-700 hover:text-sky-800">Register here</Link>
        </p>
      </div>
    </main>
  )
}