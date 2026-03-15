"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { notify } from "@/components/ui/notify"
import { Check } from "lucide-react"

interface AttendanceEmployee {
  employeeId: number
  empName: string
  mobile: string
  designation: string | null
  facePhotoUrl: string | null
}

interface AttendanceDetails {
  employee: AttendanceEmployee
  nextAction: "IN" | "OUT"
  todayRecord: {
    attendance: string
    checkInAt: string | null
    checkOutAt: string | null
    workedDuration: string
  } | null
  garageLocationConfigured: boolean
  attendanceRadiusMeters: number
  faceVerificationMode: string
}

interface ClientFaceVerificationResult {
  verified: boolean
  provider: string
  status: string
  score: number
  distance: number
  threshold: number
}

type DetectableSource = HTMLImageElement | HTMLCanvasElement

const DEVICE_EMPLOYEE_KEY = "mobile_attendance_bound_employee_id"

type FaceGuideState = "idle" | "good" | "bad"

export default function MobileAttendancePage() {
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [boundEmployeeId, setBoundEmployeeId] = useState<string>("")
  const [details, setDetails] = useState<AttendanceDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [faceApiReady, setFaceApiReady] = useState(false)
  const [faceApiError, setFaceApiError] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraAction, setCameraAction] = useState<"IN" | "OUT" | null>(null)
  const [faceGuideState, setFaceGuideState] = useState<FaceGuideState>("idle")
  const [faceGuideText, setFaceGuideText] = useState("Align your face inside the circle")
  const [qualityReady, setQualityReady] = useState(false)
  const [showSuccessTick, setShowSuccessTick] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameLoopRef = useRef<number | null>(null)
  const qualityOkCountRef = useRef(0)
  const autoSubmitTriggeredRef = useRef(false)

  const verificationConfigured = details?.faceVerificationMode !== "not_configured"
  const usesFaceApiClient = details?.faceVerificationMode === "face_api_js_client"
  const canOpenCamera = Boolean(
    details &&
      details.garageLocationConfigured &&
      details.employee.facePhotoUrl &&
      verificationConfigured &&
      (!usesFaceApiClient || faceApiReady)
  )

  useEffect(() => {
    if (!usesFaceApiClient) {
      return
    }

    let isCancelled = false

    const loadFaceApiModels = async () => {
      try {
        setFaceApiError(null)
        const faceapi = await import("face-api.js")
        const modelBaseUrl = process.env.NEXT_PUBLIC_FACE_API_MODEL_URL || "/models/faceapi"
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelBaseUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelBaseUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelBaseUrl),
        ])

        if (!isCancelled) {
          setFaceApiReady(true)
        }
      } catch (error) {
        if (!isCancelled) {
          setFaceApiReady(false)
          setFaceApiError(error instanceof Error ? error.message : "Failed to load face verification models")
        }
      }
    }

    void loadFaceApiModels()

    return () => {
      isCancelled = true
    }
  }, [usesFaceApiClient])

  const createScaledCanvas = (source: CanvasImageSource, width: number, height: number, scale: number) => {
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

  const detectDescriptor = async (source: DetectableSource) => {
    const faceapi = await import("face-api.js")
    const detectorRuns = [
      { inputSize: 512, scoreThreshold: 0.2 },
      { inputSize: 416, scoreThreshold: 0.15 },
      { inputSize: 320, scoreThreshold: 0.1 },
    ]

    for (const run of detectorRuns) {
      const detection = await faceapi
        .detectSingleFace(source, new faceapi.TinyFaceDetectorOptions(run))
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (detection) {
        return detection
      }
    }

    return null
  }

  const detectDescriptorWithFallback = async (
    source: CanvasImageSource,
    width: number,
    height: number
  ) => {
    const canvases = [
      createScaledCanvas(source, width, height, 1),
      createScaledCanvas(source, width, height, 1.75),
      createScaledCanvas(source, width, height, 2.5),
    ]

    for (const canvas of canvases) {
      const detection = await detectDescriptor(canvas)
      if (detection) {
        return detection
      }
    }

    return null
  }

  const verifyFaceWithFrame = async (
    frameCanvas: HTMLCanvasElement,
    referencePhotoUrl: string
  ): Promise<ClientFaceVerificationResult> => {
    const faceapi = await import("face-api.js")
    const threshold = Number(process.env.NEXT_PUBLIC_FACE_API_DISTANCE_THRESHOLD || 0.55)

    const referenceImage = await faceapi.fetchImage(referencePhotoUrl)
    const referenceDetection = await detectDescriptorWithFallback(
      referenceImage,
      referenceImage.naturalWidth || referenceImage.width,
      referenceImage.naturalHeight || referenceImage.height
    )

    if (!referenceDetection) {
      throw new Error("Could not detect a face in the employee reference photo. Upload a clearer front-facing photo with the full face visible.")
    }

    const frameDetection = await detectDescriptorWithFallback(
      frameCanvas,
      frameCanvas.width,
      frameCanvas.height
    )

    if (!frameDetection) {
      throw new Error("Could not detect a face from camera capture. Improve lighting and keep face centered.")
    }

    const distance = faceapi.euclideanDistance(referenceDetection.descriptor, frameDetection.descriptor)
    const score = Number((1 - distance).toFixed(4))
    const verified = distance <= threshold

    return {
      verified,
      provider: "face-api.js",
      status: verified ? "verified" : "rejected",
      score,
      distance: Number(distance.toFixed(4)),
      threshold,
    }
  }

  useEffect(() => {
    const savedEmployeeId = localStorage.getItem(DEVICE_EMPLOYEE_KEY) || ""
    if (savedEmployeeId) {
      setBoundEmployeeId(savedEmployeeId)
      setSelectedEmployeeId(savedEmployeeId)
    }

    const loadEmployees = async () => {
      try {
        const response = await fetch("/api/mobile-attendance")
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to load employees")
        }
        setEmployees(Array.isArray(data) ? data : [])
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Failed to load employees")
      }
    }

    void loadEmployees()
  }, [])

  useEffect(() => {
    if (!boundEmployeeId || employees.length === 0) {
      return
    }

    const exists = employees.some((employee) => String(employee.employeeId) === boundEmployeeId)
    if (!exists) {
      localStorage.removeItem(DEVICE_EMPLOYEE_KEY)
      setBoundEmployeeId("")
      setSelectedEmployeeId("")
      notify.error("Device was linked to an employee that is no longer eligible.")
    }
  }, [boundEmployeeId, employees])

  const stopCameraStream = () => {
    if (frameLoopRef.current != null) {
      window.clearInterval(frameLoopRef.current)
      frameLoopRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => stopCameraStream()
  }, [])

  useEffect(() => {
    if (!cameraOpen || !qualityReady || isSubmitting || autoSubmitTriggeredRef.current) {
      return
    }

    autoSubmitTriggeredRef.current = true
    void captureAndSubmitAttendance()
  }, [cameraOpen, qualityReady, isSubmitting])

  useEffect(() => {
    if (!selectedEmployeeId) {
      setDetails(null)
      return
    }

    const loadDetails = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/mobile-attendance?employeeId=${selectedEmployeeId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to load attendance details")
        }
        setDetails(data)
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Failed to load attendance details")
        setDetails(null)
      } finally {
        setIsLoading(false)
      }
    }

    void loadDetails()
  }, [selectedEmployeeId])

  const onSelectEmployee = (value: string) => {
    if (!value) {
      setSelectedEmployeeId("")
      return
    }

    if (boundEmployeeId && boundEmployeeId !== value) {
      notify.error("This device is already registered to another employee. Use De-register first.")
      return
    }

    setSelectedEmployeeId(value)

    if (!boundEmployeeId) {
      localStorage.setItem(DEVICE_EMPLOYEE_KEY, value)
      setBoundEmployeeId(value)
      notify.success("Device registered for selected employee")
    }
  }

  const deregisterDevice = () => {
    localStorage.removeItem(DEVICE_EMPLOYEE_KEY)
    setBoundEmployeeId("")
    setSelectedEmployeeId("")
    setDetails(null)
    notify.success("Device de-registered. You can now register another employee.")
  }

  const runLiveQualityCheck = async () => {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return
    }

    const faceapi = await import("face-api.js")
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) {
      qualityOkCountRef.current = 0
      setQualityReady(false)
      setFaceGuideState("bad")
      setFaceGuideText("No face detected. Center your face in the circle")
      return
    }

    const box = detection.detection.box
    const frameArea = video.videoWidth * video.videoHeight
    const faceAreaRatio = (box.width * box.height) / Math.max(frameArea, 1)
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    const normalizedCenterX = centerX / video.videoWidth
    const normalizedCenterY = centerY / video.videoHeight
    const centered =
      normalizedCenterX > 0.35 &&
      normalizedCenterX < 0.65 &&
      normalizedCenterY > 0.3 &&
      normalizedCenterY < 0.7
    const goodSize = faceAreaRatio > 0.09 && faceAreaRatio < 0.5
    const goodScore = detection.detection.score >= 0.75

    if (centered && goodSize && goodScore) {
      qualityOkCountRef.current += 1
      setFaceGuideState("good")
      setFaceGuideText("Great. Hold steady and continue")
      if (qualityOkCountRef.current >= 3) {
        setQualityReady(true)
      }
      return
    }

    qualityOkCountRef.current = 0
    setQualityReady(false)
    setFaceGuideState("bad")

    if (!centered) {
      setFaceGuideText("Move your face to the center of the circle")
    } else if (!goodSize) {
      setFaceGuideText("Move closer to camera until face fits circle")
    } else {
      setFaceGuideText("Improve lighting and hold phone steady")
    }
  }

  const openCameraForAction = async (action: "IN" | "OUT") => {
    if (!details) {
      notify.error("Select an employee first")
      return
    }

    if (!canOpenCamera) {
      notify.error("Attendance cannot be marked until all verification prerequisites are ready")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })

      streamRef.current = stream
      setCameraAction(action)
      setCameraOpen(true)
      setQualityReady(false)
      setShowSuccessTick(false)
      setFaceGuideState("idle")
      setFaceGuideText("Align your face inside the circle")
      qualityOkCountRef.current = 0
      autoSubmitTriggeredRef.current = false

      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      }, 50)

      frameLoopRef.current = window.setInterval(() => {
        void runLiveQualityCheck()
      }, 450)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to open camera")
      stopCameraStream()
      setCameraOpen(false)
    }
  }

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
      const frameCanvas = createScaledCanvas(
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
      setCameraOpen(false)
      setCameraAction(null)
      setShowSuccessTick(true)
      window.setTimeout(() => setShowSuccessTick(false), 1500)

      const refreshed = await fetch(`/api/mobile-attendance?employeeId=${details.employee.employeeId}`)
      const refreshedData = await refreshed.json()
      if (refreshed.ok) {
        setDetails(refreshedData)
      }
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
          <div className="space-y-2">
            <Label htmlFor="employeeSelect">Employee</Label>
            <select
              id="employeeSelect"
              value={selectedEmployeeId}
              onChange={(event) => onSelectEmployee(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.empName} - {employee.mobile}
                </option>
              ))}
            </select>
          </div>

          {boundEmployeeId ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
              <p className="text-xs text-slate-600">
                This device is registered for employee ID {boundEmployeeId}.
              </p>
              <Button type="button" variant="outline" onClick={deregisterDevice} className="h-8">
                De-register Device
              </Button>
            </div>
          ) : null}
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
                <img
                  src={details.employee.facePhotoUrl}
                  alt={details.employee.empName}
                  className="h-24 w-24 rounded-xl object-cover border"
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
              onClick={() => openCameraForAction(details.nextAction)}
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
                    setCameraOpen(false)
                    setCameraAction(null)
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