/**
 * GET /api/camera/feed
 *
 * Streams live MJPEG from the persistent RTSP frame buffer.
 * Each subscriber gets a continuous push of JPEG frames as a
 * multipart/x-mixed-replace response — the format all modern browsers
 * display natively inside an <img> tag.
 */

import { NextRequest } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { rtspBuffer } from "@/lib/rtsp-buffer"

export const dynamic = "force-dynamic"

const BOUNDARY = "mjpegframe"

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request)
  if (!user) return new Response("Unauthorized", { status: 401 })

  if (!rtspBuffer.isConfigured()) {
    return new Response("IP camera not configured", { status: 503 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send the current frame immediately if one is available
      const current = rtspBuffer.getFrame()
      if (current) {
        sendFrame(controller, encoder, BOUNDARY, current)
      }

      // Subscribe to future frames
      const unsub = rtspBuffer.subscribe((frame) => {
        try {
          sendFrame(controller, encoder, BOUNDARY, frame)
        } catch {
          // Client disconnected — clean up via cancel()
        }
      })

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        unsub()
        try { controller.close() } catch { /* already closed */ }
      })
    },
    cancel() {
      // ReadableStream cancelled — nothing extra to do;
      // the abort listener above handles unsubscribe
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace;boundary=${BOUNDARY}`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

function sendFrame(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  boundary: string,
  frame: Buffer
): void {
  const header =
    `--${boundary}\r\n` +
    `Content-Type: image/jpeg\r\n` +
    `Content-Length: ${frame.length}\r\n` +
    `\r\n`
  controller.enqueue(encoder.encode(header))
  controller.enqueue(new Uint8Array(frame))
  controller.enqueue(encoder.encode("\r\n"))
}
