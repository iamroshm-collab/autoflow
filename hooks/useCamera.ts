"use client"

import { useEffect, useRef, useState } from "react"
import { notify } from "@/components/ui/notify"

export type FaceGuideState = "idle" | "good" | "bad"

type CameraAction = "IN" | "OUT"

interface UseCameraOptions {
  canOpenCamera: boolean
}

export const useCamera = ({ canOpenCamera }: UseCameraOptions) => {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraAction, setCameraAction] = useState<CameraAction | null>(null)
  const [faceGuideState, setFaceGuideState] = useState<FaceGuideState>("idle")
  const [faceGuideText, setFaceGuideText] = useState("Align your face inside the circle")
  const [qualityReady, setQualityReady] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameLoopRef = useRef<number | null>(null)
  const qualityOkCountRef = useRef(0)

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

    setCameraOpen(false)
    setCameraAction(null)
    setQualityReady(false)
    setFaceGuideState("idle")
    setFaceGuideText("Align your face inside the circle")
    qualityOkCountRef.current = 0
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

  const openCameraForAction = async (action: CameraAction) => {
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
      setFaceGuideState("idle")
      setFaceGuideText("Align your face inside the circle")
      qualityOkCountRef.current = 0

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
    }
  }

  useEffect(() => {
    return () => stopCameraStream()
  }, [])

  return {
    cameraOpen,
    cameraAction,
    faceGuideState,
    faceGuideText,
    qualityReady,
    videoRef,
    openCameraForAction,
    stopCameraStream,
  }
}
