"use client"

// ── Config (toggle here for QA / staging) ─────────────────────────────────────
const TOTAL_FRAMES = 3                    // frames sampled per verification
const REQUIRED_VOTES = 2                  // minimum matching frames (2 of 3)
const FRAME_INTERVAL_MS = 300             // gap between snapshot fetches (IP cam)
const STABLE_FRAMES = 6                   // consecutive stable detections required
const STABILITY_TIMEOUT_MS = 12_000       // max wait for stability gate
const MOVEMENT_THRESHOLD = 0.06           // normalised face-centre movement limit
const FACE_MIN_AREA_RATIO = 0.04          // face box area / frame area min threshold (too far if below)
const FACE_CENTER_THRESHOLD = 0.22        // max allowed distance from frame center (normalised)

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { notify } from "@/components/ui/notify"
import { Check, Loader2, Camera, RefreshCw, AlertTriangle, ShieldX, Users } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

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
  cameraMode: "ip" | "selfie"
  todayRecord: TodayRecord | null
}

// Unified state machine for both camera modes
type FlowState =
  | "idle"        // waiting to start
  | "camera"      // camera stream opening (selfie only)
  | "stabilizing" // stability gate running — face not yet still
  | "capturing"   // fetching/capturing frames for verification
  | "verifying"   // face-api.js running majority vote
  | "submitting"  // posting to /api/attendance/start
  | "success"
  | "failed"      // face mismatch, no face, unstable, or API error

type VerifyStatus =
  | "ok"
  | "fail_no_face"
  | "fail_multiple"
  | "fail_mismatch"
  | "fail_unstable"
  | "error"

// Real-time face guidance hint produced by the stability gate
type FaceHint =
  | "no_face"    // 0 faces in frame
  | "multiple"   // 2+ faces in frame
  | "too_far"    // face too small (too far from camera)
  | "off_center" // face not centred in oval
  | "moving"     // face moving — reset stability
  | "stable"     // face stable, counting up
  | null

// ── Browser helpers ───────────────────────────────────────────────────────────

async function startCamera(videoEl: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })
  videoEl.srcObject = stream
  await videoEl.play()
  return stream
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}

function captureFromVideo(videoEl: HTMLVideoElement): string {
  const canvas = document.createElement("canvas")
  canvas.width = videoEl.videoWidth || 640
  canvas.height = videoEl.videoHeight || 480
  canvas.getContext("2d")!.drawImage(videoEl, 0, 0)
  return canvas.toDataURL("image/jpeg", 0.85)
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Cannot load image: ${src}`))
    img.src = src
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ── face-api.js — lazy singleton load ────────────────────────────────────────

let _faceapiReady = false
let _faceapi: typeof import("face-api.js") | null = null

async function getFaceAPI() {
  if (_faceapiReady && _faceapi) return _faceapi
  const m = await import("face-api.js")
  const url = process.env.NEXT_PUBLIC_FACE_API_MODEL_URL ?? "/models/faceapi"
  await Promise.all([
    m.nets.tinyFaceDetector.loadFromUri(url),
    m.nets.faceLandmark68Net.loadFromUri(url),
    m.nets.faceRecognitionNet.loadFromUri(url),
  ])
  _faceapi = m
  _faceapiReady = true
  return m
}

// ── Stability gate (unified: works on <img> and <video>) ──────────────────────
// Equivalent of stability.py — tracks face bounding-box centre movement.

async function runStabilityGate(
  faceapi: typeof import("face-api.js"),
  source: HTMLImageElement | HTMLVideoElement,
  abortRef: React.RefObject<boolean>,
  onProgress: (n: number, hint: FaceHint) => void
): Promise<boolean> {
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 160 })
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  let consecutive = 0
  let prevCx = -1
  let prevCy = -1
  const deadline = Date.now() + STABILITY_TIMEOUT_MS

  while (Date.now() < deadline && !abortRef.current) {
    await sleep(50)

    try {
      const w = (source as HTMLVideoElement).videoWidth
        || (source as HTMLImageElement).naturalWidth
        || 640
      const h = (source as HTMLVideoElement).videoHeight
        || (source as HTMLImageElement).naturalHeight
        || 480
      canvas.width = w
      canvas.height = h
      ctx.drawImage(source, 0, 0)
    } catch {
      continue
    }

    const dets = await faceapi.detectAllFaces(canvas, opts)

    if (dets.length === 0) {
      consecutive = 0
      prevCx = -1
      prevCy = -1
      onProgress(0, "no_face")
      continue
    }

    if (dets.length > 1) {
      consecutive = 0
      prevCx = -1
      prevCy = -1
      onProgress(0, "multiple")
      continue
    }

    const box = dets[0].box
    const cx = (box.x + box.width / 2) / canvas.width
    const cy = (box.y + box.height / 2) / canvas.height

    // Check if face is too small (too far from camera)
    const faceAreaRatio = (box.width * box.height) / (canvas.width * canvas.height)
    if (faceAreaRatio < FACE_MIN_AREA_RATIO) {
      consecutive = 0
      prevCx = -1
      prevCy = -1
      onProgress(0, "too_far")
      continue
    }

    // Check if face is off-center
    const distFromCenter = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2)
    if (distFromCenter > FACE_CENTER_THRESHOLD) {
      consecutive = 0
      prevCx = -1
      prevCy = -1
      onProgress(0, "off_center")
      continue
    }

    if (prevCx >= 0) {
      const movement = Math.sqrt((cx - prevCx) ** 2 + (cy - prevCy) ** 2)
      if (movement > MOVEMENT_THRESHOLD) {
        consecutive = 0
        onProgress(0, "moving")
      } else {
        consecutive++
        onProgress(consecutive, "stable")
      }
    } else {
      consecutive = 1
      onProgress(1, "stable")
    }

    prevCx = cx
    prevCy = cy

    if (consecutive >= STABLE_FRAMES) return true
  }

  return false
}

// ── Face verification helpers ─────────────────────────────────────────────────

interface VerifyResult {
  status: VerifyStatus
  score: number | null   // sent to server for audit; never shown in UI
  bestDataUrl: string | null
}

async function getRefDescriptor(
  faceapi: typeof import("face-api.js"),
  referenceUrl: string
): Promise<Float32Array | null> {
  try {
    const img = await loadImageEl(referenceUrl)
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })
    const det = await faceapi.detectSingleFace(img, opts).withFaceLandmarks().withFaceDescriptor()
    return det?.descriptor ?? null
  } catch {
    return null
  }
}

// Selfie multi-frame: captures directly from video element
async function runSelfieVerification(
  faceapi: typeof import("face-api.js"),
  videoEl: HTMLVideoElement,
  referenceUrl: string | null,
  abortRef: React.RefObject<boolean>
): Promise<VerifyResult> {
  const threshold = Number(process.env.NEXT_PUBLIC_FACE_API_DISTANCE_THRESHOLD ?? 0.55)
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })

  // If no reference photo, skip face comparison (device ID is the gate server-side)
  if (!referenceUrl) {
    const dataUrl = captureFromVideo(videoEl)
    return { status: "ok", score: null, bestDataUrl: dataUrl }
  }

  const refDesc = await getRefDescriptor(faceapi, referenceUrl)
  if (!refDesc) {
    console.warn("[VERIFY] Could not read reference photo — skipping face comparison")
    const dataUrl = captureFromVideo(videoEl)
    return { status: "ok", score: null, bestDataUrl: dataUrl }
  }

  let votes = 0
  let scoreSum = 0
  let bestScore = -Infinity
  let bestDataUrl: string | null = null
  let tailgatingDetected = false

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    if (abortRef.current) break

    const dataUrl = captureFromVideo(videoEl)
    const imgEl = await loadImageEl(dataUrl)
    const dets = await faceapi.detectAllFaces(imgEl, opts).withFaceLandmarks().withFaceDescriptors()

    if (dets.length > 1) { tailgatingDetected = true; break }

    if (dets.length === 1) {
      const dist = faceapi.euclideanDistance(refDesc, dets[0].descriptor)
      const score = 1 - dist
      if (dist <= threshold) {
        votes++
        scoreSum += score
        if (score > bestScore) { bestScore = score; bestDataUrl = dataUrl }
      }
    }

    if (i < TOTAL_FRAMES - 1) await sleep(FRAME_INTERVAL_MS)
  }

  if (tailgatingDetected) return { status: "fail_multiple", score: null, bestDataUrl: null }
  if (votes >= REQUIRED_VOTES) {
    return { status: "ok", score: Number((scoreSum / votes).toFixed(4)), bestDataUrl }
  }
  if (votes === 0) return { status: "fail_no_face", score: null, bestDataUrl }
  return { status: "fail_mismatch", score: null, bestDataUrl }
}

// IP cam multi-frame: fetches snapshots from server
async function runIPVerification(
  faceapi: typeof import("face-api.js"),
  referenceUrl: string | null,
  abortRef: React.RefObject<boolean>
): Promise<VerifyResult> {
  const threshold = Number(process.env.NEXT_PUBLIC_FACE_API_DISTANCE_THRESHOLD ?? 0.55)
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })

  if (!referenceUrl) {
    const snap = await fetchSnapshot()
    return { status: "ok", score: null, bestDataUrl: snap?.dataUrl ?? null }
  }

  const refDesc = await getRefDescriptor(faceapi, referenceUrl)
  if (!refDesc) {
    const snap = await fetchSnapshot()
    return { status: "ok", score: null, bestDataUrl: snap?.dataUrl ?? null }
  }

  let votes = 0
  let scoreSum = 0
  let bestScore = -Infinity
  let bestDataUrl: string | null = null
  let tailgating = false

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    if (abortRef.current) break

    const snap = await fetchSnapshot()
    if (!snap) { await sleep(FRAME_INTERVAL_MS); continue }

    const imgEl = await loadImageEl(snap.blobUrl)
    const dets = await faceapi.detectAllFaces(imgEl, opts).withFaceLandmarks().withFaceDescriptors()
    URL.revokeObjectURL(snap.blobUrl)

    if (dets.length > 1) { tailgating = true; break }

    if (dets.length === 1) {
      const dist = faceapi.euclideanDistance(refDesc, dets[0].descriptor)
      const score = 1 - dist
      if (dist <= threshold) {
        votes++
        scoreSum += score
        if (score > bestScore) { bestScore = score; bestDataUrl = snap.dataUrl }
      }
    }

    if (i < TOTAL_FRAMES - 1) await sleep(FRAME_INTERVAL_MS)
  }

  if (tailgating) return { status: "fail_multiple", score: null, bestDataUrl: null }
  if (votes >= REQUIRED_VOTES) {
    return { status: "ok", score: Number((scoreSum / votes).toFixed(4)), bestDataUrl }
  }
  if (votes === 0) return { status: "fail_no_face", score: null, bestDataUrl }
  return { status: "fail_mismatch", score: null, bestDataUrl }
}

async function fetchSnapshot(): Promise<{ blobUrl: string; dataUrl: string } | null> {
  try {
    const res = await fetch("/api/camera/snapshot?wait=1", { cache: "no-store" })
    if (!res.ok) return null
    const blob = await res.blob()
    return { blobUrl: URL.createObjectURL(blob), dataUrl: await blobToDataUrl(blob) }
  } catch { return null }
}

// ── Page component ────────────────────────────────────────────────────────────

export default function MobileAttendancePage() {
  const [details, setDetails] = useState<AttendanceDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [flowState, setFlowState] = useState<FlowState>("idle")
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus | null>(null)
  const [stabilityProgress, setStabilityProgress] = useState(0)
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [capturedBlobUrl, setCapturedBlobUrl] = useState<string | null>(null)

  const [faceHint, setFaceHint] = useState<FaceHint>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const liveFeedRef = useRef<HTMLImageElement>(null)
  const abortRef = useRef(false)
  // audit score — sent to server, never shown in UI
  const verifyScoreRef = useRef<number | null>(null)
  // Preload face-api models as soon as page mounts — so they're ready by the time user taps
  const faceapiPreloadRef = useRef<ReturnType<typeof getFaceAPI> | null>(null)

  // ── Preload face-api models immediately on mount ───────────────────────

  useEffect(() => {
    faceapiPreloadRef.current = getFaceAPI()
    // silence errors silently — they'll surface again at capture time
    faceapiPreloadRef.current.catch(() => {})
  }, [])

  // ── Load employee info ─────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" })
        const meData = await meRes.json()
        if (!meRes.ok) throw new Error(meData.error || "Please login to continue")

        const approvedDeviceId: string = meData?.user?.approvedDeviceId ?? ""
        const employeeRefId = Number(meData?.user?.employeeRefId)
        if (!Number.isInteger(employeeRefId))
          throw new Error("Your account is not mapped to an employee profile")
        if (!approvedDeviceId)
          throw new Error("No approved device found. Contact admin.")

        setDeviceId(approvedDeviceId)

        const attRes = await fetch(`/api/mobile-attendance?employeeId=${employeeRefId}`)
        const attData = await attRes.json()
        if (!attRes.ok) throw new Error(attData.error || "Failed to load attendance")
        setDetails(attData)
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Failed to load attendance")
      } finally {
        setIsLoading(false)
      }
    }
    void init()
  }, [])

  // Clean up camera on unmount
  useEffect(() => () => stopStream(streamRef.current), [])

  // Clean up blob URLs
  useEffect(() => () => { if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl) }, [capturedBlobUrl])

  // ── Refresh after submission ───────────────────────────────────────────

  const refreshDetails = useCallback(async (employeeId: number) => {
    const res = await fetch(`/api/mobile-attendance?employeeId=${employeeId}`)
    if (res.ok) setDetails(await res.json())
  }, [])

  // ── Submit to /api/attendance/start ───────────────────────────────────

  const submitAttendance = useCallback(async (photoDataUrl: string | null) => {
    if (!details || !deviceId) return
    setFlowState("submitting")

    try {
      const res = await fetch("/api/attendance/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: details.employee.employeeId,
          device_id: deviceId,
          attendance_type: details.nextAction,
          captured_photo: photoDataUrl,
          verification_score: verifyScoreRef.current, // audit trail — not shown in UI
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Request failed")

      if (data.success) {
        setFlowState("success")
        notify.success("Attendance recorded")
        await refreshDetails(details.employee.employeeId)
        window.setTimeout(() => setFlowState("idle"), 3000)
      } else {
        setErrorMessage(data.message || "Attendance could not be recorded")
        setFlowState("failed")
        window.setTimeout(() => { setFlowState("idle"); setErrorMessage(null) }, 4000)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to mark attendance"
      setErrorMessage(msg)
      notify.error(msg)
      setFlowState("failed")
      window.setTimeout(() => { setFlowState("idle"); setErrorMessage(null) }, 4000)
    }
  }, [details, deviceId, refreshDetails])

  // ── Selfie auto-flow ───────────────────────────────────────────────────

  const startSelfieFlow = useCallback(async () => {
    if (!details || !deviceId) return
    abortRef.current = false
    verifyScoreRef.current = null
    setVerifyStatus(null)
    setErrorMessage(null)
    setStabilityProgress(0)
    setFaceHint(null)
    setCapturedDataUrl(null)

    // 1. Open camera + finish loading models concurrently
    setFlowState("camera")
    if (!videoRef.current) return

    const cameraPromise = startCamera(videoRef.current).catch((err) => {
      throw Object.assign(err, { _cameraError: true })
    })
    const modelPromise = faceapiPreloadRef.current ?? getFaceAPI()

    let faceapi: Awaited<ReturnType<typeof getFaceAPI>>
    try {
      const [, api] = await Promise.all([cameraPromise.then((s) => { streamRef.current = s }), modelPromise])
      faceapi = api
    } catch (err: any) {
      stopStream(streamRef.current)
      if (err?._cameraError) {
        setErrorMessage("Camera permission denied. Please allow camera access and retry.")
      } else {
        setErrorMessage("Failed to load face detection models. Please try again.")
      }
      setFlowState("failed")
      return
    }

    if (abortRef.current) { stopStream(streamRef.current); return }

    // 2. Stability gate — camera and models are both ready now
    setFlowState("stabilizing")

    const stable = await runStabilityGate(
      faceapi,
      videoRef.current!,
      abortRef,
      (n, hint) => { setStabilityProgress(n); setFaceHint(hint) }
    )
    if (abortRef.current) { stopStream(streamRef.current); return }

    if (!stable) {
      stopStream(streamRef.current)
      setVerifyStatus("fail_unstable")
      setFlowState("failed")
      return
    }

    // 3. Multi-frame capture
    setFlowState("capturing")
    const result = await runSelfieVerification(faceapi, videoRef.current!, details.employee.facePhotoUrl, abortRef)
    if (abortRef.current) { stopStream(streamRef.current); return }

    stopStream(streamRef.current)
    streamRef.current = null

    if (result.status === "ok") {
      verifyScoreRef.current = result.score
      setCapturedDataUrl(result.bestDataUrl)
      setFlowState("verifying")
      await submitAttendance(result.bestDataUrl)
    } else {
      setVerifyStatus(result.status)
      setFlowState("failed")
    }
  }, [details, deviceId, submitAttendance])

  // ── IP cam auto-flow ───────────────────────────────────────────────────

  const startIPFlow = useCallback(async () => {
    if (!details) return
    abortRef.current = false
    verifyScoreRef.current = null
    setVerifyStatus(null)
    setErrorMessage(null)
    setStabilityProgress(0)
    setFaceHint(null)
    if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl)
    setCapturedBlobUrl(null)
    setCapturedDataUrl(null)

    setFlowState("camera")
    try {
      const faceapi = await (faceapiPreloadRef.current ?? getFaceAPI())
      if (abortRef.current) return

      // 1. Stability gate (on live MJPEG img)
      if (liveFeedRef.current && details.employee.facePhotoUrl) {
        setFlowState("stabilizing")
        const stable = await runStabilityGate(
          faceapi,
          liveFeedRef.current,
          abortRef,
          (n, hint) => { setStabilityProgress(n); setFaceHint(hint) }
        )
        if (abortRef.current) return
        if (!stable) {
          setVerifyStatus("fail_unstable")
          setFlowState("failed")
          return
        }
      }

      // 2. Multi-frame capture
      setFlowState("capturing")
      const result = await runIPVerification(faceapi, details.employee.facePhotoUrl, abortRef)
      if (abortRef.current) return

      if (result.bestDataUrl) setCapturedDataUrl(result.bestDataUrl)

      if (result.status === "ok") {
        verifyScoreRef.current = result.score
        setFlowState("verifying")
        await submitAttendance(result.bestDataUrl)
      } else {
        setVerifyStatus(result.status)
        setFlowState("failed")
      }
    } catch (err) {
      if (abortRef.current) return
      console.error("[IP_FLOW]", err)
      setVerifyStatus("error")
      setFlowState("failed")
    }
  }, [details, capturedBlobUrl, submitAttendance])

  // ── Cancel ─────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    abortRef.current = true
    stopStream(streamRef.current)
    streamRef.current = null
    if (capturedBlobUrl) URL.revokeObjectURL(capturedBlobUrl)
    setCapturedBlobUrl(null)
    setCapturedDataUrl(null)
    setStabilityProgress(0)
    setFaceHint(null)
    setVerifyStatus(null)
    setErrorMessage(null)
    setFlowState("idle")
  }, [capturedBlobUrl])

  // ── Derived ─────────────────────────────────────────────────────────────

  const cameraMode = details?.cameraMode ?? "selfie"
  const isBusy = ["camera", "stabilizing", "capturing", "verifying", "submitting"].includes(flowState)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      {/* Aria live region for assistive tech */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {flowState === "camera" && "Camera active. Align your face inside the ring."}
        {flowState === "stabilizing" && "Hold still. Detecting face…"}
        {flowState === "capturing" && "Capturing. Please stay still."}
        {flowState === "verifying" && "Verifying identity…"}
        {flowState === "success" && "Attendance recorded successfully."}
        {flowState === "failed" && "Verification failed. Please try again."}
      </div>

      <div className="mx-auto max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-600 mt-1">
            {cameraMode === "ip"
              ? "Stand in front of the camera to mark your attendance."
              : "Look at the camera to mark your attendance."}
          </p>
        </div>

        {isLoading && (
          <Card className="p-6 flex items-center gap-3 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </Card>
        )}

        {flowState === "success" && (
          <Card className="p-4 border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-2 text-emerald-800">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">Attendance recorded</span>
            </div>
          </Card>
        )}

        {errorMessage && flowState === "failed" && (
          <Card className="p-4 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-800 font-medium">{errorMessage}</p>
          </Card>
        )}

        {details && (
          <Card className="p-4 space-y-4">
            {/* Employee header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{details.employee.empName}</h2>
                <p className="text-sm text-slate-600">{details.employee.designation || "Employee"}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Next action: <span className="font-medium">{details.nextAction}</span>
                </p>
              </div>
              {details.employee.facePhotoUrl && (
                <Image
                  src={details.employee.facePhotoUrl}
                  alt={details.employee.empName}
                  width={64}
                  height={64}
                  className="rounded-xl object-cover border shrink-0"
                  unoptimized
                />
              )}
            </div>

            {/* Today summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <AttendanceBadgeCell value={details.todayRecord?.attendance || null} />
              <SummaryCell label="Worked" value={details.todayRecord?.workedDuration || "0m"} />
              <SummaryCell
                label="Check In"
                value={details.todayRecord?.checkInAt
                  ? new Date(details.todayRecord.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              />
              <SummaryCell
                label="Check Out"
                value={details.todayRecord?.checkOutAt
                  ? new Date(details.todayRecord.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              />
            </div>

            {/* ── Camera viewport ─────────────────────────────────────── */}
            {flowState !== "success" && (
              <div className="space-y-3">

                {/* Idle: show "Mark IN/OUT" button — no camera yet */}
                {flowState === "idle" && (
                  <Button
                    onClick={() => cameraMode === "ip" ? void startIPFlow() : void startSelfieFlow()}
                    className="w-full gap-2 h-14 text-base font-semibold"
                    size="lg"
                  >
                    <Camera className="h-5 w-5" />
                    Mark {details.nextAction}
                  </Button>
                )}

                {/* Camera viewport — shown once flow starts */}
                {flowState !== "idle" && (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">

                    {/* Selfie: front camera via MediaDevices */}
                    {cameraMode === "selfie" && (
                      /* eslint-disable-next-line jsx-a11y/media-has-caption */
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover scale-x-[-1]"
                        playsInline muted autoPlay
                      />
                    )}

                    {/* IP cam: MJPEG stream from server */}
                    {cameraMode === "ip" && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        ref={liveFeedRef}
                        src="/api/camera/feed"
                        alt="Live camera"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    )}

                    {/* Face scanner overlay — always on top of video */}
                    <FaceScanOverlay
                      flowState={flowState}
                      stabilityProgress={stabilityProgress}
                      stableFrames={STABLE_FRAMES}
                      faceHint={faceHint}
                    />
                  </div>
                )}

                {/* Failure state */}
                {flowState === "failed" && (
                  <FailureBanner status={verifyStatus} />
                )}

                {/* Controls — only visible while camera is open */}
                {flowState !== "idle" && (
                  <div className="flex gap-2">
                    {flowState === "failed" && (
                      <Button
                        onClick={() => cameraMode === "ip" ? void startIPFlow() : void startSelfieFlow()}
                        className="flex-1 gap-2"
                        size="lg"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                      </Button>
                    )}
                    {isBusy && (
                      <Button onClick={cancel} variant="outline" className="flex-1">
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  )
}

// ── Face scan overlay ──────────────────────────────────────────────────────────
// Full face-scanner UI: oval guide, corner brackets, progress arc, status label.

function FaceScanOverlay({
  flowState,
  stabilityProgress,
  stableFrames,
  faceHint,
}: {
  flowState: FlowState
  stabilityProgress: number
  stableFrames: number
  faceHint: FaceHint
}) {
  // Oval dimensions (% of container)
  const ovalW = 62   // % width
  const ovalH = 78   // % height
  const ovalCX = 50  // % from left
  const ovalCY = 46  // % from top

  // Arc around oval — approximated as a circle for the progress ring
  const arcR = 120   // px radius of the SVG arc (SVG viewport is 300×300)
  const arcCX = 150
  const arcCY = 150
  const circumference = 2 * Math.PI * arcR

  const isActive = ["capturing", "verifying", "submitting"].includes(flowState)
  const isStabilizing = flowState === "stabilizing"
  const isIdle = flowState === "idle" || flowState === "camera"

  // Warning hint: amber styling when guidance is needed (not stable/moving)
  const isWarning = isStabilizing && faceHint !== null && faceHint !== "stable" && faceHint !== "moving"

  const progress = isActive ? stableFrames : stabilityProgress
  const filled = isActive ? circumference : (progress / stableFrames) * circumference

  const arcColor = isActive
    ? "#22c55e"
    : isWarning
      ? "#fbbf24"
      : isStabilizing && stabilityProgress > 0
        ? "#86efac"
        : "rgba(255,255,255,0.0)"

  const ovalStroke = isActive
    ? "#22c55e"
    : isWarning
      ? "#fbbf24"
      : isStabilizing && stabilityProgress > 0
        ? "#86efac"
        : "rgba(255,255,255,0.55)"

  // Hint-aware real-time guidance
  const hintText: Record<NonNullable<FaceHint>, string> = {
    no_face:    "No face detected — look directly at the camera",
    multiple:   "Multiple people detected — please stand alone",
    too_far:    "Move closer to the camera",
    off_center: "Center your face inside the oval",
    moving:     "Hold still…",
    stable:     "Hold still…",
  }

  const statusText =
    flowState === "camera"
      ? "Starting camera…"
    : flowState === "stabilizing"
      ? (faceHint ? hintText[faceHint] : "Position your face in the oval")
    : flowState === "capturing"
      ? "Capturing…"
    : flowState === "verifying"
      ? "Verifying identity…"
    : flowState === "submitting"
      ? "Recording attendance…"
    : "Position your face in the oval"

  const bracketColor = isActive ? "#22c55e" : isWarning ? "#fbbf24" : "rgba(255,255,255,0.7)"
  const bracketLen = 22
  const bracketThick = 3

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Oval face guide */}
      <div
        style={{
          position: "absolute",
          left: `${ovalCX - ovalW / 2}%`,
          top: `${ovalCY - ovalH / 2}%`,
          width: `${ovalW}%`,
          height: `${ovalH}%`,
          borderRadius: "50%",
          border: `3px solid ${ovalStroke}`,
          boxShadow: isActive ? `0 0 0 4px rgba(34,197,94,0.25)` : "none",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      />

      {/* Progress arc SVG (sits over the oval) */}
      {(isStabilizing || isActive) && (
        <svg
          viewBox="0 0 300 300"
          style={{
            position: "absolute",
            left: `${ovalCX - ovalW / 2}%`,
            top: `${ovalCY - ovalH / 2}%`,
            width: `${ovalW}%`,
            height: `${ovalH}%`,
            overflow: "visible",
          }}
        >
          {/* Track */}
          <circle cx={arcCX} cy={arcCY} r={arcR}
            fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={8} />
          {/* Fill */}
          <circle cx={arcCX} cy={arcCY} r={arcR}
            fill="none"
            stroke={arcColor}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${arcCX} ${arcCY})`}
            style={{ transition: "stroke-dasharray 0.15s ease, stroke 0.3s ease" }}
          />
        </svg>
      )}

      {/* Corner bracket decorations */}
      {[
        // top-left
        { top: "3%", left: "4%", borderTop: bracketThick, borderLeft: bracketThick, borderRight: 0, borderBottom: 0 },
        // top-right
        { top: "3%", right: "4%", borderTop: bracketThick, borderRight: bracketThick, borderLeft: 0, borderBottom: 0 },
        // bottom-left
        { bottom: "22%", left: "4%", borderBottom: bracketThick, borderLeft: bracketThick, borderRight: 0, borderTop: 0 },
        // bottom-right
        { bottom: "22%", right: "4%", borderBottom: bracketThick, borderRight: bracketThick, borderLeft: 0, borderTop: 0 },
      ].map((style, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: bracketLen,
            height: bracketLen,
            borderColor: bracketColor,
            borderStyle: "solid",
            borderTopWidth: style.borderTop ?? 0,
            borderLeftWidth: style.borderLeft ?? 0,
            borderRightWidth: style.borderRight ?? 0,
            borderBottomWidth: style.borderBottom ?? 0,
            top: style.top,
            left: style.left,
            right: style.right,
            bottom: style.bottom,
            borderRadius: 3,
            transition: "border-color 0.3s ease",
          }}
        />
      ))}

      {/* Scanning line animation during stabilizing */}
      {isStabilizing && stabilityProgress > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${ovalCX - ovalW / 2 + 2}%`,
            width: `${ovalW - 4}%`,
            height: 2,
            background: "linear-gradient(90deg, transparent, #86efac, transparent)",
            animationName: "scanline",
            animationDuration: "1.4s",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            top: `${ovalCY - ovalH / 4}%`,
          }}
        />
      )}

      {/* Pulse ring when fully active / success */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            left: `${ovalCX - ovalW / 2 - 3}%`,
            top: `${ovalCY - ovalH / 2 - 2}%`,
            width: `${ovalW + 6}%`,
            height: `${ovalH + 4}%`,
            borderRadius: "50%",
            border: "2px solid rgba(34,197,94,0.4)",
            animationName: "pulse-ring",
            animationDuration: "1.2s",
            animationTimingFunction: "ease-out",
            animationIterationCount: "infinite",
          }}
        />
      )}

      {/* Status label at bottom of video */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "10px 12px",
          background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {(isStabilizing || isActive) && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin"
            style={{ color: isActive ? "#86efac" : "rgba(255,255,255,0.7)", flexShrink: 0 }}
          />
        )}
        <span style={{
          color: isActive ? "#86efac" : isWarning ? "#fde68a" : "rgba(255,255,255,0.9)",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.01em",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          {statusText}
        </span>
      </div>

    </div>
  )
}

// ── Failure banner ─────────────────────────────────────────────────────────────

function FailureBanner({ status }: { status: VerifyStatus | null }) {
  const messages: Record<string, { icon: React.ReactNode; title: string; text: string }> = {
    fail_no_face: {
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      title: "Face not detected",
      text: "Look directly at the camera. Make sure your face is clearly visible and well lit.",
    },
    fail_multiple: {
      icon: <Users className="h-4 w-4 shrink-0" />,
      title: "Multiple faces detected",
      text: "Only one person should be visible in the camera frame.",
    },
    fail_mismatch: {
      icon: <ShieldX className="h-4 w-4 shrink-0" />,
      title: "Face verification failed",
      text: "Your face could not be matched. Ensure good lighting and look straight at the camera.",
    },
    fail_unstable: {
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      title: "Could not stabilise",
      text: "Hold your phone steady and keep your face still inside the oval until the scan completes.",
    },
    error: {
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      title: "Something went wrong",
      text: "An error occurred. Please try again.",
    },
  }

  const m = status ? messages[status] : null
  if (!m) return null

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex items-center gap-2 font-semibold mb-1">
        {m.icon}
        <span>{m.title}</span>
      </div>
      <p className="text-red-700 text-xs leading-relaxed pl-6">{m.text}</p>
    </div>
  )
}

// ── Attendance badge cell ────────────────────────────────────────────────────
// H/P/A displayed as a colored badge with the rule description.

function AttendanceBadgeCell({ value }: { value: string | null }) {
  const code = (value || "—").toUpperCase()

  const config: Record<string, { label: string; rule: string; bg: string; text: string; border: string }> = {
    P: {
      label: "Present",
      rule: "≥ 7 hrs worked",
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
    },
    H: {
      label: "Half Day",
      rule: "< 7 hrs worked",
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
    },
    A: {
      label: "Absent",
      rule: "Not marked",
      bg: "bg-red-50",
      text: "text-red-800",
      border: "border-red-200",
    },
    L: {
      label: "Leave",
      rule: "On leave",
      bg: "bg-violet-50",
      text: "text-violet-800",
      border: "border-violet-200",
    },
    IN: {
      label: "Checked In",
      rule: "Awaiting check-out",
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
    },
  }

  const cfg = config[code]

  return (
    <div className={`rounded-lg border p-3 ${cfg ? `${cfg.bg} ${cfg.border}` : "bg-slate-50 border"}`}>
      <div className="text-slate-500 text-xs mb-1">Status</div>
      {cfg ? (
        <>
          <div className={`font-bold text-base ${cfg.text}`}>{cfg.label}</div>
          <div className={`text-[11px] ${cfg.text} opacity-75 mt-0.5`}>{cfg.rule}</div>
        </>
      ) : (
        <div className="font-medium text-sm">{code}</div>
      )}
    </div>
  )
}

// ── Summary cell ───────────────────────────────────────────────────────────────

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="text-slate-500 text-xs">{label}</div>
      <div className="font-medium text-sm">{value}</div>
    </div>
  )
}
