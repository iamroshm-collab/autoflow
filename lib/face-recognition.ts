/**
 * Face Recognition Service (Server-Side)
 *
 * Runs face detection and recognition by invoking a Python helper script
 * (`scripts/face_recognition_service.py`) that uses the `face_recognition`
 * library. Communication happens over a short-lived child process whose
 * stdin/stdout carry newline-delimited JSON.
 *
 * Environment variables:
 *   PYTHON_BIN                    – Python interpreter (default: python)
 *   FACE_RECOGNITION_SCRIPT       – Path to the Python script
 *                                   (default: ./scripts/face_recognition_service.py)
 *   FACE_RECOGNITION_THRESHOLD    – Similarity threshold 0–1 (default: 0.55)
 *                                   Lower = stricter; 0.55 is a good starting point.
 *   FACE_RECOGNITION_TIMEOUT_MS   – Timeout per call in ms (default: 15000)
 */

import path from "path"
import { spawn } from "child_process"

const PYTHON_BIN = (process.env.PYTHON_BIN ?? "python").trim()
const SCRIPT_PATH =
  (process.env.FACE_RECOGNITION_SCRIPT ?? "").trim() ||
  path.join(process.cwd(), "scripts", "face_recognition_service.py")
const THRESHOLD = Number(process.env.FACE_RECOGNITION_THRESHOLD ?? 0.55)
const TIMEOUT_MS = Number(process.env.FACE_RECOGNITION_TIMEOUT_MS ?? 15_000)

export interface FaceRecognitionInput {
  /** Absolute local path to the just-captured camera image */
  capturedImagePath: string
  /** Absolute local path OR public URL to the employee reference photo */
  referenceImagePath: string
}

export interface FaceRecognitionResult {
  matched: boolean
  score: number | null
  distance: number | null
  status: "verified" | "rejected" | "no_face_detected" | "error"
  reason?: string
}

interface PythonResponse {
  matched: boolean
  score: number | null
  distance: number | null
  status: string
  reason?: string
  error?: string
}

function runRecognitionScript(
  input: FaceRecognitionInput,
  timeoutMs: number
): Promise<PythonResponse> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`Face recognition script timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0 && !stdout.trim()) {
        reject(
          new Error(
            `Face recognition script exited with code ${code}: ${stderr.slice(-300)}`
          )
        )
        return
      }

      try {
        const result = JSON.parse(stdout.trim()) as PythonResponse
        resolve(result)
      } catch {
        reject(
          new Error(
            `Face recognition script returned invalid JSON. stdout: ${stdout.slice(-200)}`
          )
        )
      }
    })

    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(
        new Error(
          `Failed to start face recognition script: ${err.message}. ` +
            `Check PYTHON_BIN and FACE_RECOGNITION_SCRIPT environment variables.`
        )
      )
    })

    // Send input as JSON on stdin
    proc.stdin.write(
      JSON.stringify({
        captured_image_path: input.capturedImagePath,
        reference_image_path: input.referenceImagePath,
        threshold: THRESHOLD,
      }) + "\n"
    )
    proc.stdin.end()
  })
}

/**
 * Compares the captured camera frame against the employee's reference photo.
 * Returns a structured result indicating match status and confidence.
 */
export async function recognizeFace(
  input: FaceRecognitionInput
): Promise<FaceRecognitionResult> {
  let raw: PythonResponse

  try {
    raw = await runRecognitionScript(input, TIMEOUT_MS)
  } catch (err) {
    return {
      matched: false,
      score: null,
      distance: null,
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    }
  }

  const validStatuses = ["verified", "rejected", "no_face_detected", "error"]
  const status = validStatuses.includes(raw.status)
    ? (raw.status as FaceRecognitionResult["status"])
    : raw.matched
      ? "verified"
      : "rejected"

  return {
    matched: raw.matched === true,
    score: typeof raw.score === "number" ? raw.score : null,
    distance: typeof raw.distance === "number" ? raw.distance : null,
    status,
    reason: raw.reason ?? raw.error,
  }
}
