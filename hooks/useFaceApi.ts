"use client"

import { useEffect, useState } from "react"

export interface ClientFaceVerificationResult {
  verified: boolean
  provider: string
  status: string
  score: number
  distance: number
  threshold: number
}

type DetectableSource = HTMLImageElement | HTMLCanvasElement

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

export const useFaceApi = (usesFaceApiClient: boolean) => {
  const [faceApiReady, setFaceApiReady] = useState(false)
  const [faceApiError, setFaceApiError] = useState<string | null>(null)

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

  return {
    faceApiReady,
    faceApiError,
    verifyFaceWithFrame,
  }
}
