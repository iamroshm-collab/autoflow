import { captureFrameFromUSBCamera } from "@/lib/camera-capture"
import { recognizeFace, FaceRecognitionResult } from "@/lib/face-recognition"

export interface VerifierConfig {
  totalFrames: number
  requiredVotes: number
  frameIntervalMs: number
  maxAttempts: number
}

export interface FrameResult {
  matched: boolean
  employeeId: number | null
  score: number | null
  status: string
  capturedImagePath?: string
  capturedImagePublicUrl?: string
}

export interface VerificationResult {
  confirmed: boolean
  voteCount: number
  totalSampled: number
  avgScore: number
  frameResults: FrameResult[]
  message: string
}

const DEFAULTS = {
  totalFrames: Number(process.env.VERIFY_TOTAL_FRAMES ?? 5),
  requiredVotes: Number(process.env.VERIFY_REQUIRED_VOTES ?? 3),
  frameIntervalMs: Number(process.env.VERIFY_FRAME_INTERVAL_MS ?? 200),
  maxAttempts: Number(process.env.VERIFY_MAX_ATTEMPTS ?? 3),
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export async function verifyEmployeeMultiFrame(
  employeeId: number,
  referenceImagePath: string,
  config?: Partial<VerifierConfig>
): Promise<VerificationResult> {
  const cfg: VerifierConfig = { ...DEFAULTS, ...(config ?? {}) }

  const threshold = Number(process.env.FACE_RECOGNITION_THRESHOLD ?? 0.55)

  let overallFrameResults: FrameResult[] = []

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    let frameResults: FrameResult[] = []
    let voteCount = 0
    let scoreSum = 0
    let scoreCount = 0

    for (let i = 0; i < cfg.totalFrames; i++) {
      const filename = `attendance-${employeeId}-verify-a${attempt}-f${i}-${Date.now()}.jpg`
      let capture
      try {
        capture = await captureFrameFromUSBCamera(filename)
      } catch (err) {
        frameResults.push({ matched: false, employeeId: null, score: null, status: "error", capturedImagePath: undefined })
        continue
      }

      let res: FaceRecognitionResult
      try {
        res = await recognizeFace({ capturedImagePath: capture.filePath, referenceImagePath })
      } catch (err) {
        frameResults.push({ matched: false, employeeId: null, score: null, status: "error" })
        continue
      }

      const matched = !!res.matched && typeof res.score === "number" && res.score >= threshold
      if (res.score && matched) {
        voteCount += 1
        scoreSum += res.score
        scoreCount += 1
      }

      frameResults.push({ matched: !!res.matched, employeeId: matched ? employeeId : null, score: res.score ?? null, status: res.status, capturedImagePath: capture.filePath, capturedImagePublicUrl: capture.publicUrl })

      // Tailgating detection: if Python script signals multiple faces, abort this attempt
      if (res.status === "multiple_faces") {
        overallFrameResults = overallFrameResults.concat(frameResults)
        // small delay before retrying
        await sleep(cfg.frameIntervalMs)
        break
      }

      await sleep(cfg.frameIntervalMs)
    }

    overallFrameResults = overallFrameResults.concat(frameResults)

    const avgScore = scoreCount > 0 ? scoreSum / scoreCount : 0

    if (voteCount >= cfg.requiredVotes) {
      return {
        confirmed: true,
        voteCount,
        totalSampled: overallFrameResults.length,
        avgScore: Number(avgScore.toFixed(4)),
        frameResults: overallFrameResults,
        message: `Confirmed after attempt ${attempt}`,
      }
    }

    // If this was the last attempt, return failure with collected stats
    if (attempt === cfg.maxAttempts) {
      return {
        confirmed: false,
        voteCount,
        totalSampled: overallFrameResults.length,
        avgScore: Number(avgScore.toFixed(4)),
        frameResults: overallFrameResults,
        message: voteCount > 0 ? "Insufficient votes for confirmation" : "Face verification failed",
      }
    }

    // Otherwise, retry the attempts loop
    await sleep(cfg.frameIntervalMs)
  }

  return {
    confirmed: false,
    voteCount: 0,
    totalSampled: overallFrameResults.length,
    avgScore: 0,
    frameResults: overallFrameResults,
    message: "Verification attempts exhausted",
  }
}
