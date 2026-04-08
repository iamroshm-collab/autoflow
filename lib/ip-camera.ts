/**
 * IP Camera (RTSP) utilities
 *
 * Captures frames from an RTSP IP camera using ffmpeg.
 *
 * Environment variables:
 *   RTSP_CAMERA_URL          – Full RTSP URL, e.g. rtsp://user:pass@192.168.1.x:554/stream
 *   ATTENDANCE_CAPTURES_DIR  – Output directory (default: ./public/uploads/attendance-captures)
 */

import path from "path"
import fs from "fs/promises"
import { spawn } from "child_process"

const RTSP_URL = (process.env.RTSP_CAMERA_URL ?? "").trim()
const FFMPEG_BIN = (process.env.FFMPEG_PATH ?? "ffmpeg").trim()
const CAPTURES_DIR =
  process.env.ATTENDANCE_CAPTURES_DIR ??
  path.join(process.cwd(), "public", "uploads", "attendance-captures")

export function isIPCameraConfigured(): boolean {
  return RTSP_URL.length > 0
}

export function getRTSPUrl(): string {
  return RTSP_URL
}

export interface CaptureResult {
  filePath: string
  publicUrl: string
}

/**
 * Captures a single JPEG frame from the RTSP stream and saves it to disk.
 * Returns the local file path and its public-accessible URL.
 */
export async function captureRTSPSnapshot(filename: string): Promise<CaptureResult> {
  if (!RTSP_URL) throw new Error("RTSP_CAMERA_URL is not configured")

  await fs.mkdir(CAPTURES_DIR, { recursive: true })

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const outputPath = path.join(CAPTURES_DIR, safeFilename)

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-rtsp_transport", "tcp",
      "-i", RTSP_URL,
      "-vframes", "1",
      "-q:v", "2",
      "-update", "1",
      "-y",
      outputPath,
    ]

    const proc = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString() })

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error("RTSP snapshot timed out after 15 s"))
    }, 15_000)

    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))
    })

    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to start ffmpeg: ${err.message}`))
    })
  })

  const publicBase = path.join(process.cwd(), "public")
  const relativePath = path.relative(publicBase, outputPath).replace(/\\/g, "/")

  return { filePath: outputPath, publicUrl: `/${relativePath}` }
}
