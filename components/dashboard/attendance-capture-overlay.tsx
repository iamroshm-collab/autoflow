"use client"

// ── Shared config ─────────────────────────────────────────────────────────────
const TOTAL_FRAMES = 2
const REQUIRED_VOTES = 1
const FRAME_INTERVAL_MS = 150
const STABLE_FRAMES = 3
const STABILITY_TIMEOUT_MS = 8_000
const MOVEMENT_THRESHOLD = 0.06
const FACE_MIN_AREA_RATIO = 0.04
const FACE_CENTER_THRESHOLD = 0.22

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, SwitchCamera } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

type FlowState =
  | "camera"
  | "stabilizing"
  | "capturing"
  | "verifying"
  | "submitting"
  | "success"
  | "failed"

type VerifyStatus =
  | "ok"
  | "fail_no_face"
  | "fail_multiple"
  | "fail_mismatch"
  | "fail_unstable"
  | "error"

type FaceHint =
  | "no_face"
  | "multiple"
  | "too_far"
  | "off_center"
  | "moving"
  | "stable"
  | null

type CameraFacingMode = "user" | "environment"

// ── Browser helpers ──────────────────────────────────────────────────────────

async function startCamera(
  videoEl: HTMLVideoElement,
  facingMode: CameraFacingMode,
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function waitForVideoReady(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  abortRef: React.RefObject<boolean>,
  timeoutMs = 2000,
): Promise<HTMLVideoElement | null> {
  const start = Date.now()
  while (!abortRef.current && Date.now() - start < timeoutMs) {
    if (videoRef.current) return videoRef.current
    await sleep(20)
  }
  return videoRef.current ?? null
}

// ── face-api.js singleton ────────────────────────────────────────────────────

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

// ── Stability gate ───────────────────────────────────────────────────────────

async function runStabilityGate(
  faceapi: typeof import("face-api.js"),
  source: HTMLVideoElement,
  abortRef: React.RefObject<boolean>,
  onProgress: (n: number, hint: FaceHint) => void,
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
      const w = source.videoWidth || 640
      const h = source.videoHeight || 480
      canvas.width = w
      canvas.height = h
      ctx.drawImage(source, 0, 0)
    } catch {
      continue
    }

    const dets = await faceapi.detectAllFaces(canvas, opts)

    if (dets.length === 0) {
      consecutive = 0; prevCx = -1; prevCy = -1
      onProgress(0, "no_face"); continue
    }
    if (dets.length > 1) {
      consecutive = 0; prevCx = -1; prevCy = -1
      onProgress(0, "multiple"); continue
    }

    const box = dets[0].box
    const cx = (box.x + box.width / 2) / canvas.width
    const cy = (box.y + box.height / 2) / canvas.height

    if ((box.width * box.height) / (canvas.width * canvas.height) < FACE_MIN_AREA_RATIO) {
      consecutive = 0; prevCx = -1; prevCy = -1
      onProgress(0, "too_far"); continue
    }
    if (Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2) > FACE_CENTER_THRESHOLD) {
      consecutive = 0; prevCx = -1; prevCy = -1
      onProgress(0, "off_center"); continue
    }

    if (prevCx >= 0) {
      const movement = Math.sqrt((cx - prevCx) ** 2 + (cy - prevCy) ** 2)
      if (movement > MOVEMENT_THRESHOLD) {
        consecutive = 0; onProgress(0, "moving")
      } else {
        consecutive++; onProgress(consecutive, "stable")
      }
    } else {
      consecutive = 1; onProgress(1, "stable")
    }

    prevCx = cx; prevCy = cy
    if (consecutive >= STABLE_FRAMES) return true
  }
  return false
}

// ── Face verification ────────────────────────────────────────────────────────

interface VerifyResult {
  status: VerifyStatus
  score: number | null
  bestDataUrl: string | null
}

async function getRefDescriptor(
  faceapi: typeof import("face-api.js"),
  referenceUrl: string,
): Promise<Float32Array | null> {
  try {
    const img = await loadImageEl(referenceUrl)
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
    const det = await faceapi.detectSingleFace(img, opts).withFaceLandmarks().withFaceDescriptor()
    return det?.descriptor ?? null
  } catch {
    return null
  }
}

async function runVerification(
  faceapi: typeof import("face-api.js"),
  videoEl: HTMLVideoElement,
  referenceUrl: string | null,
  abortRef: React.RefObject<boolean>,
): Promise<VerifyResult> {
  const threshold = Number(process.env.NEXT_PUBLIC_FACE_API_DISTANCE_THRESHOLD ?? 0.55)
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })

  if (!referenceUrl) {
    return { status: "ok", score: null, bestDataUrl: captureFromVideo(videoEl) }
  }

  const refDesc = await getRefDescriptor(faceapi, referenceUrl)
  if (!refDesc) {
    return { status: "ok", score: null, bestDataUrl: captureFromVideo(videoEl) }
  }

  let votes = 0
  let scoreSum = 0
  let bestScore = -Infinity
  let bestDataUrl: string | null = null
  let tailgating = false

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    if (abortRef.current) break
    const dataUrl = captureFromVideo(videoEl)
    const imgEl = await loadImageEl(dataUrl)
    const dets = await faceapi
      .detectAllFaces(imgEl, opts)
      .withFaceLandmarks()
      .withFaceDescriptors()

    if (dets.length > 1) { tailgating = true; break }
    if (dets.length === 1) {
      const dist = faceapi.euclideanDistance(refDesc, dets[0].descriptor)
      const score = 1 - dist
      if (dist <= threshold) {
        votes++; scoreSum += score
        if (score > bestScore) { bestScore = score; bestDataUrl = dataUrl }
      }
    }
    if (i < TOTAL_FRAMES - 1) await sleep(FRAME_INTERVAL_MS)
  }

  if (tailgating) return { status: "fail_multiple", score: null, bestDataUrl: null }
  if (votes >= REQUIRED_VOTES) {
    return { status: "ok", score: Number((scoreSum / votes).toFixed(4)), bestDataUrl }
  }
  if (votes === 0) return { status: "fail_no_face", score: null, bestDataUrl: null }
  return { status: "fail_mismatch", score: null, bestDataUrl: null }
}

// ── Exported component ───────────────────────────────────────────────────────

interface AttendanceCaptureOverlayProps {
  employeeId: number
  deviceId: string
  nextAction: "IN" | "OUT"
  facePhotoUrl: string | null
  onSuccess: () => void
  onCancel: () => void
}

export function AttendanceCaptureOverlay({
  employeeId,
  deviceId,
  nextAction,
  facePhotoUrl,
  onSuccess,
  onCancel,
}: AttendanceCaptureOverlayProps) {
  const [flowState, setFlowState] = useState<FlowState>("camera")
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus | null>(null)
  const [stabilityProgress, setStabilityProgress] = useState(0)
  const [faceHint, setFaceHint] = useState<FaceHint>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<CameraFacingMode>("user")
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  // Circle geometry shared between the video clip and the overlay
  const circleR  = viewport.w > 0 ? Math.min(Math.floor(viewport.w * 0.40), 155) : 140
  const circleCX = viewport.w > 0 ? Math.round(viewport.w / 2) : 190
  const circleCY = viewport.h > 0 ? Math.round(viewport.h * 0.40) : 300
  const videoClipPath = viewport.w > 0
    ? `circle(${circleR}px at ${circleCX}px ${circleCY}px)`
    : undefined

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const abortRef = useRef(false)
  const verifyScoreRef = useRef<number | null>(null)
  const faceapiPreloadRef = useRef<ReturnType<typeof getFaceAPI> | null>(null)

  // Kick off model preload the instant this overlay mounts
  useEffect(() => {
    faceapiPreloadRef.current = getFaceAPI()
    faceapiPreloadRef.current.catch(() => {})
  }, [])

  // Stop stream on unmount
  useEffect(() => () => { stopStream(streamRef.current) }, [])

  const runFlow = useCallback(async (facing: CameraFacingMode) => {
    abortRef.current = false
    verifyScoreRef.current = null
    setVerifyStatus(null)
    setErrorMessage(null)
    setStabilityProgress(0)
    setFaceHint(null)
    setFlowState("camera")

    const videoEl = await waitForVideoReady(videoRef, abortRef)
    if (!videoEl) {
      setErrorMessage("Camera did not initialise. Please try again.")
      setFlowState("failed")
      return
    }

    // Camera + models in parallel
    const cameraPromise = startCamera(videoEl, facing).catch((err) => {
      throw Object.assign(err, { _cam: true })
    })
    const modelPromise = faceapiPreloadRef.current ?? getFaceAPI()

    let faceapi: Awaited<ReturnType<typeof getFaceAPI>>
    try {
      const [, api] = await Promise.all([
        cameraPromise.then((s) => { streamRef.current = s }),
        modelPromise,
      ])
      faceapi = api
    } catch (err: any) {
      stopStream(streamRef.current)
      setErrorMessage(
        err?._cam
          ? "Camera permission denied. Please allow camera access and retry."
          : "Failed to load face detection models. Please try again.",
      )
      setFlowState("failed")
      return
    }

    if (abortRef.current) { stopStream(streamRef.current); return }

    // Stability gate
    setFlowState("stabilizing")
    const stable = await runStabilityGate(
      faceapi, videoEl, abortRef,
      (n, hint) => { setStabilityProgress(n); setFaceHint(hint) },
    )
    if (abortRef.current) { stopStream(streamRef.current); return }

    if (!stable) {
      stopStream(streamRef.current)
      setVerifyStatus("fail_unstable")
      setFlowState("failed")
      return
    }

    // Capture + verify
    setFlowState("capturing")
    const result = await runVerification(faceapi, videoEl, facePhotoUrl, abortRef)
    if (abortRef.current) { stopStream(streamRef.current); return }

    stopStream(streamRef.current)
    streamRef.current = null

    if (result.status !== "ok") {
      setVerifyStatus(result.status)
      setFlowState("failed")
      return
    }

    // Submit
    verifyScoreRef.current = result.score
    setFlowState("submitting")
    try {
      const res = await fetch("/api/attendance/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          device_id: deviceId,
          attendance_type: nextAction,
          captured_photo: result.bestDataUrl,
          verification_score: verifyScoreRef.current,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Request failed")

      if (data.success) {
        setFlowState("success")
        window.setTimeout(() => onSuccess(), 1800)
      } else {
        setErrorMessage(data.message || "Attendance could not be recorded")
        setFlowState("failed")
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to mark attendance")
      setFlowState("failed")
    }
  }, [employeeId, deviceId, nextAction, facePhotoUrl, onSuccess])

  // Auto-start camera the instant the overlay mounts
  useEffect(() => {
    void runFlow(facingMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBack = useCallback(() => {
    abortRef.current = true
    stopStream(streamRef.current)
    streamRef.current = null
    onCancel()
  }, [onCancel])

  const handleRetry = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
    void runFlow(facingMode)
  }, [facingMode, runFlow])

  const handleSwitchCamera = useCallback(() => {
    const next: CameraFacingMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(next)
    stopStream(streamRef.current)
    streamRef.current = null
    void runFlow(next)
  }, [facingMode, runFlow])

  const isBusy = ["camera", "stabilizing", "capturing", "verifying", "submitting"].includes(flowState)

  return (
    <div className="fixed inset-0 z-[60]" style={{ background: "rgb(232,230,224)" }}>
      {/* Camera feed — clipped to circle so nothing outside it is visible */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        style={{ clipPath: videoClipPath, transition: "clip-path 0s" }}
        playsInline
        muted
        autoPlay
      />

      {/* Full-screen overlay: border ring + scan animation + status */}
      <FaceScanOverlay
        flowState={flowState}
        stabilityProgress={stabilityProgress}
        stableFrames={STABLE_FRAMES}
        faceHint={faceHint}
        verifyStatus={verifyStatus}
        errorMessage={errorMessage}
        circleR={circleR}
        circleCX={circleCX}
        circleCY={circleCY}
      />

      {/* Top bar: Back + Switch camera */}
      <div className="absolute top-4 left-0 right-0 px-4 flex items-center justify-between z-[70]">
        <Button onClick={handleBack} variant="outline" className="bg-white border-slate-300 text-slate-700 shadow-sm">
          Back
        </Button>
        {(isBusy || flowState === "failed") && (
          <Button onClick={handleSwitchCamera} variant="outline" className="bg-white border-slate-300 text-slate-700 shadow-sm gap-2">
            <SwitchCamera className="h-4 w-4" />
            {facingMode === "user" ? "Rear" : "Front"}
          </Button>
        )}
      </div>

      {/* Bottom bar: Try Again on failure */}
      {flowState === "failed" && (
        <div className="absolute bottom-6 left-0 right-0 px-4 z-[70]">
          <Button
            onClick={handleRetry}
            className="w-full gap-2 h-12 text-base font-semibold"
            size="lg"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}

      {/* Success tick */}
      {flowState === "success" && (
        <div className="absolute inset-0 flex items-center justify-center z-[70]">
          <div className="flex flex-col items-center gap-3 text-slate-800">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
              <svg viewBox="0 0 24 24" className="h-9 w-9 stroke-white fill-none" strokeWidth={2.5}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <p className="text-lg font-semibold">Attendance recorded</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Face scan overlay ─────────────────────────────────────────────────────────

function FaceScanOverlay({
  flowState,
  stabilityProgress,
  stableFrames,
  faceHint,
  verifyStatus,
  errorMessage,
  circleR,
  circleCX,
  circleCY,
}: {
  flowState: FlowState
  stabilityProgress: number
  stableFrames: number
  faceHint: FaceHint
  verifyStatus: VerifyStatus | null
  errorMessage: string | null
  circleR: number
  circleCX: number
  circleCY: number
}) {
  const isActive      = ["capturing", "verifying", "submitting"].includes(flowState)
  const isStabilizing = flowState === "stabilizing"
  const isWarning     = isStabilizing && faceHint !== null && faceHint !== "stable" && faceHint !== "moving"
  const isFailed      = flowState === "failed"

  // Border colour
  const borderColor = isFailed   ? "#ef4444"
    : isActive                   ? "#22c55e"
    : isWarning                  ? "#fbbf24"
    : isStabilizing && stabilityProgress > 0 ? "#86efac"
    : "rgba(34,197,94,0.45)"

  const glowColor = isFailed ? "rgba(239,68,68,0.30)"
    : isActive                ? "rgba(34,197,94,0.35)"
    : "rgba(34,197,94,0.15)"

  // Status text
  const hintText: Record<NonNullable<FaceHint>, string> = {
    no_face:    "No face detected — look directly at the camera",
    multiple:   "Multiple people detected — please stand alone",
    too_far:    "Move closer to the camera",
    off_center: "Center your face in the circle",
    moving:     "Hold still…",
    stable:     "Hold still…",
  }
  const failMessages: Record<string, string> = {
    fail_no_face:  "No face detected. Look directly at the camera.",
    fail_multiple: "Multiple faces detected. Please stand alone.",
    fail_mismatch: "Face verification failed. Try with better lighting.",
    fail_unstable: "Could not stabilize. Hold still and keep your face centered.",
    error:         "Something went wrong. Please try again.",
  }
  const statusText =
    flowState === "camera"      ? "Starting camera…"
    : flowState === "stabilizing" ? (faceHint ? hintText[faceHint] : "Position your face in the circle")
    : flowState === "capturing"   ? "Capturing…"
    : flowState === "verifying"   ? "Verifying identity…"
    : flowState === "submitting"  ? "Recording attendance…"
    : flowState === "failed"      ? (errorMessage || failMessages[verifyStatus || "error"] || "Please try again.")
    : flowState === "success"     ? "Attendance recorded!"
    : "Position your face in the circle"

  const statusTone: "green" | "orange" | "red" =
    isFailed ? "red" : isActive || faceHint === "stable" ? "green" : "orange"
  const toneStyles = {
    green:  "bg-emerald-50 border-emerald-300 text-emerald-700",
    orange: "bg-amber-50 border-amber-300 text-amber-700",
    red:    "bg-rose-50 border-rose-300 text-rose-700",
  }

  const statusY = circleCY + circleR + 28

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

      {/* ── Border ring + glow + pulse drawn with SVG ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Glow ring */}
        <circle
          cx={circleCX} cy={circleCY} r={circleR + 6}
          fill="none" stroke={glowColor} strokeWidth={14}
          style={{ transition: "stroke 0.3s ease" }}
        />

        {/* Green border */}
        <circle
          cx={circleCX} cy={circleCY} r={circleR}
          fill="none" stroke={borderColor} strokeWidth={3.5}
          style={{ transition: "stroke 0.3s ease" }}
        />

        {/* Pulse ring when active */}
        {isActive && (
          <circle
            cx={circleCX} cy={circleCY} r={circleR + 2}
            fill="none" stroke="rgba(34,197,94,0.45)" strokeWidth={2}
            style={{
              animationName: "pulse-ring",
              animationDuration: "1.2s",
              animationTimingFunction: "ease-out",
              animationIterationCount: "infinite",
            }}
          />
        )}
      </svg>

      {/* ── Scanning animation clipped inside the circle ── */}
      {(isStabilizing && stabilityProgress > 0) && (
        <div
          style={{
            position: "absolute",
            left: circleCX - circleR,
            top: circleCY - circleR,
            width: circleR * 2,
            height: circleR * 2,
            borderRadius: "50%",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.85) 50%, transparent)",
              animationName: "face-scan",
              animationDuration: "1.6s",
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
            }}
          />
        </div>
      )}

      {/* ── Status message below the circle ── */}
      {flowState !== "success" && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl border text-sm font-medium text-center w-[82%] max-w-sm flex items-center justify-center gap-2 ${toneStyles[statusTone]}`}
          style={{ top: statusY, backdropFilter: "blur(4px)" }}
        >
          {(isStabilizing || isActive) && statusTone !== "red" && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin shrink-0"
              style={{ color: isActive ? "#16a34a" : "#d97706" }}
            />
          )}
          <span>{statusText}</span>
        </div>
      )}
    </div>
  )
}
