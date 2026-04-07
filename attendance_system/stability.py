"""
stability.py
------------
Face stability detection — ensures the subject is stationary before the
recognition pipeline is triggered.

Why stability matters
---------------------
Face embeddings are sensitive to motion blur and partial-frame occlusion.
A person still walking toward the camera, or someone looking away while
approaching, will produce degraded embeddings that reduce match confidence
and inflate the false-reject rate.  Requiring the face to be still for N
consecutive frames before recognition starts guarantees that:
  • the embedding model receives a sharp, well-posed input
  • the face is fully inside the detection zone
  • only one person is present (tailgating is implicitly excluded during
    the stability window because zone_count != 1 resets the counter)

Architecture
------------

    StabilityDetector.wait_for_stable(camera, pipeline)
    │
    ├── poll loop (at most stability_timeout_s seconds):
    │     ├── get_frame_with_time()        — lightweight buffer read
    │     ├── pipeline.detect_single_face_in_zone()  — cascade only, no embed
    │     ├── _calculate_movement(prev_rect, curr_rect)
    │     │     Euclidean distance between bounding-box centres:
    │     │         d = sqrt((cx2-cx1)² + (cy2-cy1)²)
    │     ├── movement > threshold  →  reset counter, log
    │     └── movement <= threshold  →  increment counter
    │
    └── counter >= stable_frames_required  →  return StabilityResult(stable=True)

Movement metric
---------------
We compare bounding-box CENTRES, not raw corners, because:
  • The Haar cascade produces slightly different bounding boxes for the same
    face between frames (detection jitter of ±2–4 px is normal).
  • Centre movement is more physically meaningful: it captures where the
    face IS, independent of bounding-box size variation.

Threshold calibration guide
---------------------------
The movement_threshold_px value is in pixels of the raw camera resolution.
Scale it based on the typical face bounding-box width at your installation:

  Camera distance   Typical face width   Recommended threshold
  ─────────────────────────────────────────────────────────────
  ~50 cm  (close)      250–350 px          20–30 px
  ~100 cm (1 m)        120–180 px          10–18 px  ← default (15 px)
  ~150 cm (1.5 m)       70–110 px           8–12 px
  ~200 cm (2 m)         50–80 px            5–9 px

As a rule of thumb: threshold ≈ face_width × 0.08–0.12  (8–12% of width).
Setting it too low makes the system reject normal breathing/head sway.
Setting it too high lets recognition trigger while the person is still moving.

To make the threshold automatically distance-independent, set
`movement_threshold_fraction` (0.0 to 1.0) instead of the absolute value.
When both are set, the fraction is applied to the detected face width and
used if it is larger than movement_threshold_px, giving a safety floor.

Thread safety
-------------
StabilityDetector is stateless between calls — all state (prev_rect,
consecutive counter) is local to wait_for_stable().  Safe to call from
multiple threads without locking.
"""

import math
import time
import logging
from dataclasses import dataclass
from typing import Optional, Tuple

from .camera_stream import CameraStream
from .face_pipeline import FacePipeline

logger = logging.getLogger(__name__)


# ── Configuration ──────────────────────────────────────────────────────────────

@dataclass
class StabilityConfig:
    """
    Tunable parameters for the face stability pre-gate.

    stable_frames_required
        Number of consecutive frames the face must remain still before
        recognition starts.  Higher = more robust, longer wait.
        Default 10 at 15 fps ≈ 0.67 s of stillness.

    movement_threshold_px
        Maximum Euclidean distance (pixels) between consecutive face
        bounding-box centres that is still considered "stable".
        See the calibration guide in the module docstring.

    movement_threshold_fraction
        Optional face-size-relative threshold (fraction of face width).
        When > 0, the effective threshold is:
            max(movement_threshold_px,
                detected_face_width * movement_threshold_fraction)
        Set to 0.0 to use only the absolute pixel value.

    stability_timeout_s
        Hard deadline for the stability wait.  If the face does not
        stabilise within this many seconds, wait_for_stable() returns
        StabilityResult(stable=False, timed_out=True).

    poll_interval_s
        Sleep between frame polls when the buffer has not been updated.
        Lower = more responsive but slightly higher CPU.  The camera
        buffer updates at target_fps Hz, so values < 1/target_fps spin
        unnecessarily.  Default 0.05 s matches a 20 fps poll rate,
        suitable for cameras at 15–30 fps.
    """
    stable_frames_required: int = 10
    movement_threshold_px: float = 15.0
    movement_threshold_fraction: float = 0.0   # 0 = disabled
    stability_timeout_s: float = 10.0
    poll_interval_s: float = 0.05


# ── Result ─────────────────────────────────────────────────────────────────────

@dataclass
class StabilityResult:
    """
    Outcome of a stability wait.

    stable                  — True when the required consecutive count was reached.
    stable_frame_count      — how many consecutive stable frames were observed
                              (equals stable_frames_required on success).
    required_frames         — echo of the config value.
    stable_face_rect        — bounding rect from the last stable frame;
                              None when stable=False.
    timed_out               — True when the deadline elapsed before stability.
    wait_time_s             — wall-clock seconds spent in the stability gate.
    message                 — human-readable status for display / logging.
    """
    stable: bool
    stable_frame_count: int = 0
    required_frames: int = 0
    stable_face_rect: Optional[Tuple[int, int, int, int]] = None
    timed_out: bool = False
    wait_time_s: float = 0.0
    message: str = ""


# ── Detector ───────────────────────────────────────────────────────────────────

class StabilityDetector:
    """
    Polls the camera buffer until the face bounding box is stationary for
    `stable_frames_required` consecutive frames, or a timeout elapses.

    Stateless between calls — all tracking variables are local to
    wait_for_stable(), so the object is safe to share across threads.
    """

    def __init__(self, config: StabilityConfig) -> None:
        self._cfg = config
        logger.info(
            "StabilityDetector ready. required_frames=%d  "
            "threshold=%.1fpx  timeout=%.1fs",
            config.stable_frames_required,
            config.movement_threshold_px,
            config.stability_timeout_s,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def wait_for_stable(
        self,
        camera: CameraStream,
        pipeline: FacePipeline,
    ) -> StabilityResult:
        """
        Block until the face is stable or the timeout elapses.

        Poll loop internals
        -------------------
        On each iteration:
          1. Read the latest (frame, frame_time) from the camera buffer.
             Skip if it is the same frame as the last iteration.
          2. Call pipeline.detect_single_face_in_zone() — cascade only,
             no embedding.  Returns None if:
               • no faces detected
               • more than one zone face (tailgating)
               • face outside the detection zone
             Any of these resets the consecutive counter to 0.
          3. If a face rect is returned and prev_rect exists, compute
             Euclidean centre-to-centre movement.
             • movement > threshold → reset, log at DEBUG
             • movement <= threshold → increment counter, log at DEBUG
          4. If consecutive == stable_frames_required → success.

        The poll_interval_s sleep only fires when the frame buffer has not
        been updated (same frame_time as last iteration), preventing busy-spin.
        When a new frame arrives the loop processes it immediately.
        """
        cfg = self._cfg
        start_time = time.monotonic()
        deadline = start_time + cfg.stability_timeout_s

        # State variables — all local to this call (thread-safe).
        consecutive: int = 0           # consecutive stable frames so far
        prev_rect: Optional[Tuple[int, int, int, int]] = None
        last_seen_time: float = -1.0   # frame_time of last processed frame

        logger.info(
            "Stability gate: waiting for %d consecutive stable frames "
            "(threshold=%.1fpx, timeout=%.1fs).",
            cfg.stable_frames_required,
            cfg.movement_threshold_px,
            cfg.stability_timeout_s,
        )

        while True:
            # ── Hard deadline ──────────────────────────────────────────────
            now = time.monotonic()
            if now > deadline:
                elapsed = now - start_time
                logger.warning(
                    "Stability gate timed out after %.1fs "
                    "(achieved %d/%d stable frames).",
                    elapsed,
                    consecutive,
                    cfg.stable_frames_required,
                )
                return StabilityResult(
                    stable=False,
                    stable_frame_count=consecutive,
                    required_frames=cfg.stable_frames_required,
                    timed_out=True,
                    wait_time_s=round(elapsed, 3),
                    message="Hold still for verification.",
                )

            # ── Read camera buffer ─────────────────────────────────────────
            frame, frame_time = camera.get_frame_with_time()

            if frame is None or frame_time <= last_seen_time:
                # No new frame yet — yield CPU and retry.
                time.sleep(cfg.poll_interval_s)
                continue

            last_seen_time = frame_time

            # ── Lightweight face detection (no embedding) ──────────────────
            # detect_single_face_in_zone() returns None if zero or ≥2 zone
            # faces are present, which resets the stability counter.  This
            # implicitly rejects tailgating during the stability window.
            rect = pipeline.detect_single_face_in_zone(frame)

            if rect is None:
                # Face absent, multiple faces, or out-of-zone — reset.
                if consecutive > 0:
                    logger.debug(
                        "Stability reset (no valid single zone face). "
                        "Was at %d/%d.",
                        consecutive,
                        cfg.stable_frames_required,
                    )
                consecutive = 0
                prev_rect = None
                continue

            # ── Movement calculation ───────────────────────────────────────
            if prev_rect is None:
                # First frame with a detectable face — start counting.
                # We cannot compute movement without a previous position,
                # so we treat this as "stable enough for frame 1".
                prev_rect = rect
                consecutive = 1
                logger.debug(
                    "Stability: first face detected at centre (%.0f, %.0f). "
                    "Counter: 1/%d.",
                    rect[0] + rect[2] / 2,
                    rect[1] + rect[3] / 2,
                    cfg.stable_frames_required,
                )
                continue

            movement = self._calculate_movement(prev_rect, rect)
            threshold = self._effective_threshold(rect)

            if movement > threshold:
                # ── Movement exceeds threshold — reset the counter ─────────
                #
                # Why we reset to 0 (not 1):
                # If we kept the current frame as the new "anchor" and counted
                # it, a fast-moving face could rack up stable counts by always
                # being compared to its own previous position.  Starting fresh
                # at 0 requires the face to be genuinely still for the full
                # required window.
                logger.debug(
                    "Stability reset: movement=%.1fpx > threshold=%.1fpx. "
                    "Counter reset to 0.",
                    movement,
                    threshold,
                )
                consecutive = 0
                prev_rect = rect   # update anchor to current position
            else:
                # ── Face is stable — increment counter ─────────────────────
                #
                # We update prev_rect on every stable frame so that the
                # threshold is always compared against the most recent position.
                # This prevents accumulated drift: if the face drifts 14 px
                # over 10 frames (below threshold each step), the counter
                # still completes — and that's correct, because the face
                # truly was stable relative to each predecessor.
                consecutive += 1
                prev_rect = rect
                logger.debug(
                    "Stability: movement=%.1fpx <= threshold=%.1fpx. "
                    "Counter: %d/%d.",
                    movement,
                    threshold,
                    consecutive,
                    cfg.stable_frames_required,
                )

            # ── Check if stability requirement is met ──────────────────────
            if consecutive >= cfg.stable_frames_required:
                elapsed = time.monotonic() - start_time
                logger.info(
                    "Stability CONFIRMED after %.2fs "
                    "(%d consecutive stable frames).",
                    elapsed,
                    consecutive,
                )
                return StabilityResult(
                    stable=True,
                    stable_frame_count=consecutive,
                    required_frames=cfg.stable_frames_required,
                    stable_face_rect=rect,
                    timed_out=False,
                    wait_time_s=round(elapsed, 3),
                    message="",
                )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _calculate_movement(
        self,
        prev_rect: Tuple[int, int, int, int],
        curr_rect: Tuple[int, int, int, int],
    ) -> float:
        """
        Euclidean distance between the centres of two bounding rects.

        Why centre-to-centre?
        ─────────────────────
        The Haar cascade introduces detection jitter: the bounding box of a
        perfectly still face shifts by ±2–5 px between frames due to the
        sliding-window scan grid and scale quantisation.  Raw corner
        comparison (x, y) would amplify this jitter.

        Centre comparison is more stable because:
          • Box-size changes (different scale step detected) do not shift
            the centre as much as they shift the corners.
          • It is invariant to whether the cascade found the face slightly
            larger or smaller this frame.

        Formula:
            cx = x + w/2,  cy = y + h/2
            d = √((cx2 - cx1)² + (cy2 - cy1)²)

        This is O(1) with no array allocation.
        """
        px, py, pw, ph = prev_rect
        cx1, cy1 = px + pw / 2.0, py + ph / 2.0

        qx, qy, qw, qh = curr_rect
        cx2, cy2 = qx + qw / 2.0, qy + qh / 2.0

        return math.sqrt((cx2 - cx1) ** 2 + (cy2 - cy1) ** 2)

    def _effective_threshold(self, rect: Tuple[int, int, int, int]) -> float:
        """
        Return the effective movement threshold in pixels.

        If movement_threshold_fraction > 0, compute the face-size-relative
        threshold and take the larger of the two.  This provides:
          • A minimum floor (movement_threshold_px) so detection jitter
            never triggers a reset even for very close faces.
          • Automatic scaling for varying camera distances when the fraction
            is set — a distant face (small box) gets a proportionally
            smaller threshold.

        Example: face_width=150px, fraction=0.10, abs=15px
            relative = 150 * 0.10 = 15px
            effective = max(15, 15) = 15px   (same at "standard" distance)

        Example: face_width=300px (close camera), fraction=0.10, abs=15px
            relative = 300 * 0.10 = 30px
            effective = max(15, 30) = 30px   (appropriately more lenient)
        """
        cfg = self._cfg
        if cfg.movement_threshold_fraction > 0.0:
            face_width = rect[2]  # w component of (x, y, w, h)
            relative = face_width * cfg.movement_threshold_fraction
            return max(cfg.movement_threshold_px, relative)
        return cfg.movement_threshold_px
