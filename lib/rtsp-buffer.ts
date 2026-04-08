/**
 * rtsp-buffer.ts
 * --------------
 * Node.js equivalent of camera_stream.py.
 *
 * A singleton that runs a persistent ffmpeg process in the background,
 * continuously decoding RTSP frames at ~10 fps and keeping the latest
 * JPEG frame in memory.
 *
 * Architecture
 * ------------
 *   RTSPBuffer (singleton)
 *   ├── _startProcess()    — spawns ffmpeg, pipes stdout → MJPEG parser
 *   ├── _parseMJPEG()      — scans byte stream for JPEG SOI/EOI markers,
 *   │                        extracts complete JPEG frames, stores latest
 *   └── getFrame()         — returns the latest buffered frame (Buffer | null)
 *
 * Reconnection
 * ------------
 * If ffmpeg exits (network drop, camera reboot, etc.) the process is
 * restarted after RECONNECT_DELAY_MS. Stale-frame detection: if no new frame
 * arrives within STALE_TIMEOUT_MS the process is killed and restarted.
 *
 * Thread safety
 * -------------
 * Node.js is single-threaded; no locking is needed. All I/O callbacks run
 * in the event loop — reads and writes to _latestFrame are always atomic.
 */

import { spawn, ChildProcess } from "child_process"

const FFMPEG_BIN = (process.env.FFMPEG_PATH ?? "ffmpeg").trim()
const RTSP_URL = (process.env.RTSP_CAMERA_URL ?? "").trim()
const RECONNECT_DELAY_MS = 3_000
const STALE_TIMEOUT_MS = 8_000
const TARGET_FPS = 10

// JPEG start-of-image / end-of-image marker bytes
const SOI = Buffer.from([0xff, 0xd8])
const EOI = Buffer.from([0xff, 0xd9])

class RTSPBuffer {
  private _proc: ChildProcess | null = null
  private _latestFrame: Buffer | null = null
  private _frameTime: number = 0
  private _running = false
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _staleTimer: ReturnType<typeof setTimeout> | null = null
  private _pending: Buffer = Buffer.alloc(0) // incomplete MJPEG frame accumulator

  // ── Subscribers for live streaming ──────────────────────────────────────────
  // Each subscriber is a callback that receives a complete JPEG frame Buffer.
  private _subscribers: Set<(frame: Buffer) => void> = new Set()

  subscribe(cb: (frame: Buffer) => void): () => void {
    this._subscribers.add(cb)
    // Auto-start when first subscriber arrives
    if (!this._running) this.start()
    return () => this._subscribers.delete(cb)
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  start(): void {
    if (this._running || !RTSP_URL) return
    this._running = true
    this._spawnProcess()
  }

  stop(): void {
    this._running = false
    this._clearStaleTimer()
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._killProcess()
  }

  /** Returns the most recently buffered JPEG frame, or null if none yet. */
  getFrame(): Buffer | null {
    return this._latestFrame
  }

  /** Returns the monotonic timestamp (Date.now()) of the last received frame. */
  getFrameTime(): number {
    return this._frameTime
  }

  isConfigured(): boolean {
    return RTSP_URL.length > 0
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private _spawnProcess(): void {
    if (!RTSP_URL) return

    const args = [
      "-rtsp_transport", "tcp",
      "-i", RTSP_URL,
      "-q:v", "5",
      "-vf", `fps=${TARGET_FPS},scale=640:480`,
      "-f", "mjpeg",
      "pipe:1",
    ]

    console.log("[RTSPBuffer] Starting ffmpeg process…")
    this._proc = spawn(FFMPEG_BIN, args, { stdio: ["ignore", "pipe", "ignore"] })
    this._pending = Buffer.alloc(0)
    this._resetStaleTimer()

    this._proc.stdout!.on("data", (chunk: Buffer) => {
      this._parseMJPEG(chunk)
    })

    this._proc.on("close", (code) => {
      console.log(`[RTSPBuffer] ffmpeg exited (code ${code}). Reconnecting in ${RECONNECT_DELAY_MS}ms…`)
      this._clearStaleTimer()
      this._proc = null
      if (this._running) {
        this._reconnectTimer = setTimeout(() => this._spawnProcess(), RECONNECT_DELAY_MS)
      }
    })

    this._proc.on("error", (err) => {
      console.error("[RTSPBuffer] ffmpeg error:", err.message)
    })
  }

  /**
   * Parse incoming bytes as an MJPEG stream.
   *
   * ffmpeg's -f mjpeg output is a raw concatenation of JPEG files:
   *   [FFD8 … FFD9] [FFD8 … FFD9] …
   * We scan for SOI (FFD8) and EOI (FFD9) markers to extract complete frames.
   *
   * The `_pending` buffer carries over incomplete data between data events.
   */
  private _parseMJPEG(chunk: Buffer): void {
    this._pending = Buffer.concat([this._pending, chunk])

    let start = 0
    while (true) {
      // Find the start of the next JPEG frame
      const soiIdx = this._pending.indexOf(SOI, start)
      if (soiIdx === -1) {
        // No SOI found — keep tail in pending (it might be a partial SOI)
        this._pending = this._pending.slice(Math.max(0, this._pending.length - 1))
        break
      }

      // Find the matching EOI after the SOI
      const eoiIdx = this._pending.indexOf(EOI, soiIdx + 2)
      if (eoiIdx === -1) {
        // Frame not complete yet — keep from SOI onward
        this._pending = this._pending.slice(soiIdx)
        break
      }

      // Extract the complete JPEG frame (inclusive of SOI and EOI)
      const frameEnd = eoiIdx + EOI.length
      const frame = this._pending.slice(soiIdx, frameEnd)

      // Store and notify subscribers
      this._latestFrame = frame
      this._frameTime = Date.now()
      this._resetStaleTimer()

      for (const cb of this._subscribers) {
        try { cb(frame) } catch { /* subscriber error — ignore */ }
      }

      start = frameEnd
    }

    // If the pending buffer grew very large without a complete frame, trim it
    if (this._pending.length > 2 * 1024 * 1024 /* 2 MB */) {
      console.warn("[RTSPBuffer] Pending buffer too large — dropping partial data")
      this._pending = Buffer.alloc(0)
    }
  }

  private _resetStaleTimer(): void {
    this._clearStaleTimer()
    this._staleTimer = setTimeout(() => {
      console.warn("[RTSPBuffer] No frame for", STALE_TIMEOUT_MS, "ms — restarting ffmpeg…")
      this._killProcess()
      if (this._running) {
        this._reconnectTimer = setTimeout(() => this._spawnProcess(), RECONNECT_DELAY_MS)
      }
    }, STALE_TIMEOUT_MS)
  }

  private _clearStaleTimer(): void {
    if (this._staleTimer) {
      clearTimeout(this._staleTimer)
      this._staleTimer = null
    }
  }

  private _killProcess(): void {
    if (this._proc) {
      try { this._proc.kill("SIGTERM") } catch { /* already dead */ }
      this._proc = null
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────
//
// In Next.js development the module is reloaded on HMR.  We attach the
// singleton to globalThis to survive module reloads without spawning duplicate
// ffmpeg processes.

const GLOBAL_KEY = "__rtspBuffer__"

function getOrCreateBuffer(): RTSPBuffer {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    const buf = new RTSPBuffer()
    if (buf.isConfigured()) buf.start()
    ;(globalThis as any)[GLOBAL_KEY] = buf
  }
  return (globalThis as any)[GLOBAL_KEY] as RTSPBuffer
}

export const rtspBuffer = getOrCreateBuffer()
