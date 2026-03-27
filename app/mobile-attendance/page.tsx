"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { notify } from "@/components/ui/notify"
import { AttendanceDetails, useAttendanceDetails } from "@/hooks/useAttendanceDetails"
import { useCamera } from "@/hooks/useCamera"
import { ClientFaceVerificationResult, useFaceApi } from "@/hooks/useFaceApi"
import { Check } from "lucide-react"

export default function MobileAttendancePage() {
  const { details, isLoading, refreshDetails } = useAttendanceDetails()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessTick, setShowSuccessTick] = useState(false)

  const autoSubmitTriggeredRef = useRef(false)

  const verificationConfigured = details?.faceVerificationMode !== "not_configured"
  const usesFaceApiClient = details?.faceVerificationMode === "face_api_js_client"
  const { faceApiReady, faceApiError, verifyFaceWithFrame } = useFaceApi(usesFaceApiClient)
  const canOpenCamera = Boolean(
    details &&
      details.garageLocationConfigured &&
      details.employee.facePhotoUrl &&
      verificationConfigured &&
      (!usesFaceApiClient || faceApiReady)
  )
  const {
    cameraOpen,
    cameraAction,
    faceGuideState,
    faceGuideText,
    qualityReady,
    videoRef,
    openCameraForAction,
    stopCameraStream,
  } = useCamera({ canOpenCamera })

  const createCaptureCanvas = (source: CanvasImageSource, width: number, height: number, scale: number) => {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(Math.round(width * scale), 320)
    canvas.height = Math.max(Math.round(height * scale), 240)
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("Failed to prepare face verification canvas")
    }

    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  useEffect(() => {
    if (!cameraOpen || !qualityReady || isSubmitting || autoSubmitTriggeredRef.current) {
      return
    }

    autoSubmitTriggeredRef.current = true
    void captureAndSubmitAttendance()
  }, [cameraOpen, qualityReady, isSubmitting])

  const captureAndSubmitAttendance = async () => {
    if (!details) {
      notify.error("Select an employee first")
      return
    }

    if (!cameraAction) {
      notify.error("Attendance action is missing")
      return
    }

    if (!qualityReady) {
      notify.error("Face quality is not ready yet. Keep your face centered and well lit.")
      autoSubmitTriggeredRef.current = false
      return
    }

    if (!videoRef.current) {
      notify.error("Camera is not ready")
      autoSubmitTriggeredRef.current = false
      return
    }

    if (!navigator.geolocation) {
      notify.error("Geolocation is not supported on this phone")
      return
    }

    setIsSubmitting(true)
    try {
      let clientVerificationPayload: ClientFaceVerificationResult | null = null
      const frameCanvas = createCaptureCanvas(
        videoRef.current,
        videoRef.current.videoWidth || 640,
        videoRef.current.videoHeight || 480,
        1.25
      )

      if (usesFaceApiClient) {
        if (!faceApiReady) {
          throw new Error("Face verification models are not ready yet")
        }

        if (!details.employee.facePhotoUrl) {
          throw new Error("Employee reference photo is missing")
        }

        const result = await verifyFaceWithFrame(frameCanvas, details.employee.facePhotoUrl)

        if (!result.verified) {
          throw new Error("Face verification did not match the employee reference photo")
        }

        clientVerificationPayload = result
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })

      const evidenceBlob = await new Promise<Blob>((resolve, reject) => {
        frameCanvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to capture attendance evidence"))
            return
          }
          resolve(blob)
        }, "image/jpeg", 0.92)
      })

      const evidenceFile = new File([evidenceBlob], `attendance-${details.employee.employeeId}-${cameraAction}.jpg`, {
        type: "image/jpeg",
      })

      const uploadFormData = new FormData()
      uploadFormData.append("file", evidenceFile)
      uploadFormData.append("employeeId", String(details.employee.employeeId))
      uploadFormData.append("action", cameraAction)

      const uploadResponse = await fetch("/api/uploads/attendance-video", {
        method: "POST",
        body: uploadFormData,
      })
      const uploadData = await uploadResponse.json()
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "Failed to upload attendance video")
      }

      const attendanceResponse = await fetch("/api/mobile-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: details.employee.employeeId,
          action: cameraAction,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          videoUrl: uploadData.videoUrl,
          clientVerification: clientVerificationPayload
        }),
      })
      const attendanceData = await attendanceResponse.json()
      if (!attendanceResponse.ok) {
        throw new Error(attendanceData.error || "Failed to mark attendance")
      }

      notify.success(`Attendance ${cameraAction} marked successfully`)
      stopCameraStream()
      setShowSuccessTick(true)
      window.setTimeout(() => setShowSuccessTick(false), 1500)

      await refreshDetails()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to mark attendance")
      autoSubmitTriggeredRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mobile Attendance</h1>
          <p className="text-sm text-slate-600 mt-1">
            Mark IN or OUT using live camera verification.
          </p>
        </div>

        {showSuccessTick ? (
          <Card className="p-3 border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-2 text-emerald-800">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">Attendance marked successfully</span>
            </div>
          </Card>
        ) : null}

        <Card className="p-4 space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs text-slate-600">
              Attendance is auto-bound to your approved employee profile and approved device.
            </p>
          </div>
        </Card>

        {isLoading ? <Card className="p-4 text-sm text-slate-600">Loading attendance details...</Card> : null}

        {details ? (
          <Card className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{details.employee.empName}</h2>
                <p className="text-sm text-slate-600">{details.employee.designation || "Employee"}</p>
                <p className="text-sm text-slate-600">Next action: {details.nextAction}</p>
              </div>
              {details.employee.facePhotoUrl ? (
                <Image
                  src={details.employee.facePhotoUrl}
                  alt={details.employee.empName}
                  width={96}
                  height={96}
                  className="rounded-xl object-cover border"
                />
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Today Status</div>
                <div className="font-medium">{details.todayRecord?.attendance || "A"}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Worked Time</div>
                <div className="font-medium">{details.todayRecord?.workedDuration || "0m"}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Check In</div>
                <div className="font-medium">{details.todayRecord?.checkInAt ? new Date(details.todayRecord.checkInAt).toLocaleTimeString() : "-"}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-slate-500">Check Out</div>
                <div className="font-medium">{details.todayRecord?.checkOutAt ? new Date(details.todayRecord.checkOutAt).toLocaleTimeString() : "-"}</div>
              </div>
            </div>

            {!details.employee.facePhotoUrl ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Reference photo is missing for this employee. Ask admin to upload the latest face photo first.
              </div>
            ) : null}

            {!verificationConfigured ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Face verification provider is not configured yet. Admin must set a verification provider before mobile attendance can be marked.
              </div>
            ) : null}

            {usesFaceApiClient && faceApiError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                face-api.js models failed to load: {faceApiError}
              </div>
            ) : null}

            <Button
              onClick={() => {
                setShowSuccessTick(false)
                autoSubmitTriggeredRef.current = false
                void openCameraForAction(details.nextAction)
              }}
              disabled={isSubmitting || !canOpenCamera}
              className="w-full"
            >
              {isSubmitting ? "Submitting..." : `Mark ${details.nextAction}`}
            </Button>
          </Card>
        ) : null}

        {cameraOpen ? (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black">
                <video ref={videoRef} className="w-full aspect-[3/4] object-cover" autoPlay muted playsInline />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className={`relative w-72 h-72 rounded-full border-4 transition-colors duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ${
                      faceGuideState === "good"
                        ? "border-emerald-400"
                        : faceGuideState === "bad"
                          ? "border-red-400"
                          : "border-white/70"
                    }`}
                  >
                    <div className="absolute inset-0 rounded-full bg-transparent" />
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-white/90">{faceGuideText}</p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    stopCameraStream()
                    autoSubmitTriggeredRef.current = false
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-center text-xs text-white/70">
                {qualityReady ? "Face verified. Marking attendance..." : "Waiting for stable face and lighting..."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}