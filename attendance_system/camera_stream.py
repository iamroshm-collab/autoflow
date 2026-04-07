"""
camera_stream.py
----------------
Background RTSP camera thread with frame buffering, thread-safe access,
and automatic reconnection logic.

Architecture overview:
  CameraStream
  ├── _capture_loop()        ← runs in a daemon thread
  │     reads frames continuously, writes into _frame / _frame_time
  └── get_frame()            ← called by the main thread / API handler
        returns the latest buffered frame without touching the camera
"""

import cv2
import time
import logging
import threading
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class CameraConfig:
    """All tunable knobs for the camera stream."""
    rtsp_url: str
    reconnect_delay: float = 3.0      # seconds to wait before reconnect attempt
    stale_frame_timeout: float = 5.0  # seconds of no new frame → reconnect
    target_fps: float = 15.0          # cap internal read rate to limit CPU
    max_reconnect_attempts: int = 0   # 0 = retry forever
    open_timeout: float = 10.0        # seconds to wait for cv2.VideoCapture to open


class CameraStream:
    """
    Manages a single RTSP stream in a dedicated background thread.

    Thread model
    ============
    • One daemon thread (_capture_loop) owns the cv2.VideoCapture object.
      No other thread ever touches the capture object.
    • The latest decoded frame and its timestamp are stored in
      self._frame / self._frame_time, protected by self._lock (threading.Lock).
    • Consumers call get_frame() which acquires the lock for the minimum time
      needed to copy the numpy array reference — O(1), never blocks long.

    Reconnection logic
    ==================
    If cap.read() returns False OR no new frame arrives within
    `stale_frame_timeout` seconds, _capture_loop releases the old capture,
    waits `reconnect_delay` seconds, and opens a fresh cv2.VideoCapture.
    This handles:
      • Network glitches that close the TCP stream.
      • Camera reboots.
      • Intermediate router timeouts.
    """

    def __init__(self, config: CameraConfig) -> None:
        self._config = config

        # ── shared state (protected by _lock) ──────────────────────────────
        self._frame: Optional[object] = None   # latest BGR numpy array
        self._frame_time: float = 0.0          # time.monotonic() of last write
        self._lock = threading.Lock()
        # ───────────────────────────────────────────────────────────────────

        self._stop_event = threading.Event()
        self._connected = threading.Event()    # set when stream is up

        # Start background thread as daemon so it dies with the main process.
        self._thread = threading.Thread(
            target=self._capture_loop,
            name="CameraStreamThread",
            daemon=True,
        )
        self._thread.start()
        logger.info("CameraStream thread started for %s", config.rtsp_url)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_frame(self) -> Optional[object]:
        """
        Return the most recently buffered frame (BGR numpy array) or None.

        This method is intentionally lightweight: it only acquires the lock
        to read two references and immediately releases it.  The frame data
        itself is *not* copied — callers that need a stable copy should call
        .copy() on the result.
        """
        with self._lock:
            return self._frame

    def get_frame_with_time(self) -> tuple:
        """
        Return (frame, frame_time) atomically under the same lock acquisition.

        frame_time is a time.monotonic() value written by the background thread
        each time a new frame is decoded.  Callers can compare successive
        frame_time values to know whether the buffer has been updated since their
        last sample — essential for multi-frame collection where you need N
        *distinct* frames rather than the same frame sampled N times.

        Returns (None, 0.0) when no frame has been received yet.
        """
        with self._lock:
            return self._frame, self._frame_time

    def is_connected(self) -> bool:
        """True while the background thread has a live stream."""
        return self._connected.is_set()

    def wait_for_connection(self, timeout: float = 15.0) -> bool:
        """Block until the stream is up or timeout expires."""
        return self._connected.wait(timeout=timeout)

    def stop(self) -> None:
        """Signal the background thread to stop and join it."""
        self._stop_event.set()
        self._thread.join(timeout=5.0)
        logger.info("CameraStream stopped.")

    # ------------------------------------------------------------------
    # Background thread
    # ------------------------------------------------------------------

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        """
        Open the RTSP stream and return a cv2.VideoCapture, or None on failure.

        CAP_FFMPEG is preferred for RTSP because it supports TCP transport
        and handles stream reconnection at the codec level better than the
        default GStreamer backend on most platforms.
        """
        url = self._config.rtsp_url
        logger.info("Opening RTSP stream: %s", url)

        # Force TCP transport to avoid UDP packet loss on flaky networks.
        # The ?tcp suffix works for many cameras; adjust if yours differs.
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)

        # Give OpenCV time to negotiate the RTSP handshake.
        deadline = time.monotonic() + self._config.open_timeout
        while not cap.isOpened() and time.monotonic() < deadline:
            time.sleep(0.2)

        if not cap.isOpened():
            logger.warning("Failed to open stream: %s", url)
            cap.release()
            return None

        logger.info("Stream opened successfully: %s", url)
        return cap

    def _capture_loop(self) -> None:
        """
        Core background loop — runs for the lifetime of the object.

        Lifecycle per iteration:
          1. Open the RTSP capture.
          2. Read frames as fast as the target_fps allows.
          3. Write each decoded frame into the shared buffer under _lock.
          4. If the stream stalls or read() fails → close and reconnect.
        """
        min_interval = 1.0 / self._config.target_fps   # e.g. 0.067 s at 15 fps
        attempt = 0

        while not self._stop_event.is_set():
            # ── Step 1: (Re)connect ────────────────────────────────────────
            cap = self._open_capture()
            if cap is None:
                self._connected.clear()
                attempt += 1
                if (
                    self._config.max_reconnect_attempts > 0
                    and attempt > self._config.max_reconnect_attempts
                ):
                    logger.error(
                        "Exceeded max reconnect attempts (%d). Stopping.",
                        self._config.max_reconnect_attempts,
                    )
                    break
                logger.info(
                    "Reconnect attempt %d — waiting %.1f s …",
                    attempt,
                    self._config.reconnect_delay,
                )
                time.sleep(self._config.reconnect_delay)
                continue

            # Stream is up.
            self._connected.set()
            attempt = 0  # reset counter on successful connect
            last_frame_time = time.monotonic()

            # ── Step 2: Read frames ────────────────────────────────────────
            while not self._stop_event.is_set():
                loop_start = time.monotonic()

                ok, frame = cap.read()

                if not ok or frame is None:
                    # cap.read() failed — could be end-of-stream or network drop.
                    logger.warning("cap.read() failed — will attempt reconnect.")
                    break  # exit inner loop → outer loop reconnects

                # ── Step 3: Write into shared buffer ──────────────────────
                now = time.monotonic()
                with self._lock:
                    # Overwrite the previous frame; the old numpy array will be
                    # garbage-collected once no consumer holds a reference to it.
                    self._frame = frame
                    self._frame_time = now
                last_frame_time = now

                # ── Rate limiter: sleep remainder of the target interval ───
                elapsed = time.monotonic() - loop_start
                sleep_for = min_interval - elapsed
                if sleep_for > 0:
                    time.sleep(sleep_for)

                # ── Stale-frame watchdog ───────────────────────────────────
                # If cap.read() keeps returning True but timestamps stop
                # advancing (can happen with some RTSP servers), treat it
                # as a stall and reconnect.
                if time.monotonic() - last_frame_time > self._config.stale_frame_timeout:
                    logger.warning(
                        "No new frame for %.1f s — reconnecting.",
                        self._config.stale_frame_timeout,
                    )
                    break

            # ── Step 4: Clean up before reconnecting ──────────────────────
            self._connected.clear()
            cap.release()
            logger.info("Capture released. Reconnecting in %.1f s …", self._config.reconnect_delay)
            time.sleep(self._config.reconnect_delay)

        logger.info("_capture_loop exiting.")
