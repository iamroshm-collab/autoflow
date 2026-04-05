/**
 * Camera Capture Service
 *
 * Activates the USB webcam connected to the garage server PC,
 * captures a single frame via ffmpeg, and saves it to disk.
 *
 * Environment variables:
 *   USB_CAMERA_DEVICE   – DirectShow device name on Windows,
 *                         e.g. "USB2.0 Camera" (run: ffmpeg -list_devices true -f dshow -i dummy)
 *   USB_CAMERA_INDEX    – Device index fallback (default: 0)
 *   ATTENDANCE_CAPTURES_DIR – Output directory (default: ./public/uploads/attendance-captures)
 */

import path from "path"
import fs from "fs/promises"
import { spawn } from "child_process"

const CAPTURES_DIR =
  process.env.ATTENDANCE_CAPTURES_DIR ??
  path.join(process.cwd(), "public", "uploads", "attendance-captures")

const CAPTURE_TIMEOUT_MS = 12_000

function runCommand(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] })

    let stderr = ""
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`Camera capture timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-300)}`))
      }
    })

    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to start ffmpeg: ${err.message}`))
    })
  })
}

function buildFfmpegArgs(outputPath: string): string[] {
  const isWindows = process.platform === "win32"
  const cameraDevice = (process.env.USB_CAMERA_DEVICE ?? "").trim()
  const cameraIndex = (process.env.USB_CAMERA_INDEX ?? "0").trim()

  if (isWindows) {
    const inputDevice = cameraDevice ? `video="${cameraDevice}"` : `video=${cameraIndex}`
    return [
      "-f", "dshow",
      "-i", inputDevice,
      "-frames:v", "1",
      "-q:v", "2",
      "-y",
      outputPath,
    ]
  }

  // Linux (V4L2)
  return [
    "-f", "v4l2",
    "-i", `/dev/video${cameraIndex}`,
    "-frames:v", "1",
    "-q:v", "2",
    "-y",
    outputPath,
  ]
}

export interface CaptureResult {
  filePath: string
  publicUrl: string
}

/**
 * Activates the USB camera, captures one frame, saves as JPEG.
 * Returns the local file path and the public-accessible URL.
 */
export async function captureFrameFromUSBCamera(filename: string): Promise<CaptureResult> {
  await fs.mkdir(CAPTURES_DIR, { recursive: true })

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const outputPath = path.join(CAPTURES_DIR, safeFilename)

  const ffmpegArgs = buildFfmpegArgs(outputPath)

  try {
    await runCommand("ffmpeg", ffmpegArgs, CAPTURE_TIMEOUT_MS)
  } catch (err) {
    throw new Error(
      `USB camera capture failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // Verify the file was actually written
  try {
    await fs.access(outputPath)
  } catch {
    throw new Error("Camera capture completed but output file was not found on disk")
  }

  // Derive a public URL from the captures dir relative to /public
  const publicBase = path.join(process.cwd(), "public")
  const relativePath = path.relative(publicBase, outputPath).replace(/\\/g, "/")
  const publicUrl = `/${relativePath}`

  return { filePath: outputPath, publicUrl }
}
