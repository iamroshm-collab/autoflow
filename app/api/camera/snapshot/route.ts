/**
 * GET /api/camera/snapshot
 *
 * Returns the latest JPEG frame from the persistent RTSP buffer.
 * Because the buffer maintains a continuously updated frame, this
 * responds in < 5 ms — enabling rapid multi-frame sampling for the
 * majority-vote verification flow.
 *
 * Query params:
 *   wait  – if "1", waits up to 5 s for a frame if none is buffered yet
 */

import { NextRequest } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { rtspBuffer } from "@/lib/rtsp-buffer"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request)
  if (!user) return new Response("Unauthorized", { status: 401 })

  if (!rtspBuffer.isConfigured()) {
    return new Response(
      JSON.stringify({ error: "IP camera not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  const shouldWait = request.nextUrl.searchParams.get("wait") === "1"

  let frame = rtspBuffer.getFrame()

  // If no frame yet (buffer just started) optionally wait up to 5 s
  if (!frame && shouldWait) {
    frame = await waitForFirstFrame(5_000)
  }

  if (!frame) {
    return new Response(
      JSON.stringify({ error: "Camera not ready. Try again in a moment." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  return new Response(frame, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-cache, no-store",
      "Content-Length": String(frame.length),
    },
  })
}

function waitForFirstFrame(timeoutMs: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const deadline = setTimeout(() => {
      unsub()
      resolve(null)
    }, timeoutMs)

    const unsub = rtspBuffer.subscribe((frame) => {
      clearTimeout(deadline)
      unsub()
      resolve(frame)
    })
  })
}
