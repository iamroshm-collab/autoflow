"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { notify } from "@/components/ui/notify"
import { Check, Loader2, Camera } from "lucide-react"

interface AttendanceEmployee {
  employeeId: number
  empName: string
  designation: string | null
  facePhotoUrl: string | null
}

interface TodayRecord {
  attendance: string
  checkInAt: string | null
  checkOutAt: string | null
  workedDuration: string
}

interface AttendanceDetails {
  employee: AttendanceEmployee
  nextAction: "IN" | "OUT"
  todayRecord: TodayRecord | null
}

type SubmitState = "idle" | "verifying" | "success" | "failed"

export default function MobileAttendancePage() {
  const [details, setDetails] = useState<AttendanceDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Load employee info and the approved device_id from session
  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" })
        const meData = await meRes.json()
        if (!meRes.ok) throw new Error(meData.error || "Please login to continue")

        const approvedDeviceId: string = meData?.user?.approvedDeviceId ?? ""
        const employeeRefId = Number(meData?.user?.employeeRefId)
        if (!Number.isInteger(employeeRefId)) {
          throw new Error("Your account is not mapped to an employee profile")
        }
        if (!approvedDeviceId) {
          throw new Error("No approved device found for this account. Contact admin.")
        }

        setDeviceId(approvedDeviceId)

        const attRes = await fetch(`/api/mobile-attendance?employeeId=${employeeRefId}`)
        const attData = await attRes.json()
        if (!attRes.ok) throw new Error(attData.error || "Failed to load attendance details")

        setDetails(attData)
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Failed to load attendance")
      } finally {
        setIsLoading(false)
      }
    }

    void init()
  }, [])

  const refreshDetails = async (employeeId: number) => {
    const res = await fetch(`/api/mobile-attendance?employeeId=${employeeId}`)
    if (res.ok) {
      const data = await res.json()
      setDetails(data)
    }
  }

  const handleMarkAttendance = async () => {
    if (!details || !deviceId) return

    setSubmitState("verifying")
    setErrorMessage(null)

    try {
      const res = await fetch("/api/attendance/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: details.employee.employeeId,
          device_id: deviceId,
          attendance_type: details.nextAction,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Request failed")
      }

      if (data.success) {
        setSubmitState("success")
        notify.success("Attendance recorded")
        await refreshDetails(details.employee.employeeId)
        window.setTimeout(() => setSubmitState("idle"), 2500)
      } else {
        // Verified HTTP 200 but face did not match
        setSubmitState("failed")
        setErrorMessage(data.message || "Face verification failed")
        window.setTimeout(() => {
          setSubmitState("idle")
          setErrorMessage(null)
        }, 4000)
      }
    } catch (err) {
      setSubmitState("failed")
      const msg = err instanceof Error ? err.message : "Failed to mark attendance"
      setErrorMessage(msg)
      notify.error(msg)
      window.setTimeout(() => {
        setSubmitState("idle")
        setErrorMessage(null)
      }, 4000)
    }
  }

  const isVerifying = submitState === "verifying"

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tap the button below — the attendance camera will verify your identity.
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6 flex items-center gap-3 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </Card>
        ) : null}

        {/* Success banner */}
        {submitState === "success" ? (
          <Card className="p-4 border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-2 text-emerald-800">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">Attendance recorded successfully</span>
            </div>
          </Card>
        ) : null}

        {/* Error banner */}
        {submitState === "failed" && errorMessage ? (
          <Card className="p-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-800 font-medium">{errorMessage}</p>
          </Card>
        ) : null}

        {details ? (
          <Card className="p-4 space-y-4">
            {/* Employee header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{details.employee.empName}</h2>
                <p className="text-sm text-slate-600">{details.employee.designation || "Employee"}</p>
                <p className="text-sm text-slate-500 mt-0.5">Next: {details.nextAction}</p>
              </div>
              {details.employee.facePhotoUrl ? (
                <Image
                  src={details.employee.facePhotoUrl}
                  alt={details.employee.empName}
                  width={80}
                  height={80}
                  className="rounded-xl object-cover border"
                />
              ) : null}
            </div>

            {/* Today summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Status</div>
                <div className="font-medium">{details.todayRecord?.attendance || "—"}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Worked</div>
                <div className="font-medium">{details.todayRecord?.workedDuration || "0m"}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Check In</div>
                <div className="font-medium">
                  {details.todayRecord?.checkInAt
                    ? new Date(details.todayRecord.checkInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Check Out</div>
                <div className="font-medium">
                  {details.todayRecord?.checkOutAt
                    ? new Date(details.todayRecord.checkOutAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </div>
              </div>
            </div>

            {/* Camera instruction shown while verifying */}
            {isVerifying ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-3">
                <Camera className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Please look at the attendance camera</p>
                  <p className="text-xs text-blue-700 mt-0.5">Verifying your identity…</p>
                </div>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-auto shrink-0" />
              </div>
            ) : null}

            {/* Main action button */}
            <Button
              onClick={() => void handleMarkAttendance()}
              disabled={isVerifying || submitState === "success"}
              className="w-full"
              size="lg"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                `Mark ${details.nextAction}`
              )}
            </Button>

            <p className="text-xs text-center text-slate-400">
              Attendance is verified by the camera at the garage. No phone camera is used.
            </p>
          </Card>
        ) : null}
      </div>
    </main>
  )
}
