"""
verifier.py
-----------
Multi-frame majority-vote verification with integrated anti-tailgating detection.

Architecture
------------

    MultiFrameVerifier.verify(camera, pipeline)
    │
    └── outer attempt loop  (up to max_attempts)
          │
          └── _run_attempt(camera, pipeline)
                │
                ├── for each of total_frames:
                │     ├── _next_distinct_frame(camera)   — blocks until a new
                │     │                                     frame arrives in buffer
                │     ├── pipeline.process(frame)         — full pipeline call;
                │     │                                     face_count already set
                │     ├── TAILGATING CHECK
                │     │     face_count > 1  →  abort attempt immediately,
                │     │                        log audit event, return
                │     │                        VerificationResult(tailgating=True)
                │     └── accumulate FaceResult for voting
                │
                └── _vote(accumulated_results)

    Back in verify():
      • tailgating_detected=True  →  wait tailgating_cooldown_s, retry
      • confirmed or non-tailgating failure  →  return immediately

Anti-tailgating design
----------------------
Face count is provided by FaceResult.face_count, which FacePipeline.process()
populates using _count_zone_faces() — the same detection run that process()
already performs.  There is NO second detection call; tailgating detection
costs O(F) extra time where F is the number of raw detected faces (usually <5).

The zone filter matters: a face at the far edge of the camera's field of view
(outside the detection zone) does not trigger tailgating.  Only faces whose
bounding-box centre falls inside the configured zone are counted.

Restart-on-tailgating
---------------------
When tailgating is detected mid-attempt:
  1. The attempt is aborted immediately (remaining frames are not collected).
  2. A WARNING-level audit log is emitted with timestamp and frame index.
  3. The outer loop waits `tailgating_cooldown_s` to let the zone clear.
  4. A fresh attempt starts from frame 0.
  5. After `max_attempts` exhausted, the final tailgating result is returned.

Thread safety
-------------
verify() is called from the FastAPI request thread.  It only reads from
CameraStream (via get_frame_with_time()) and calls FacePipeline.process(),
both of which are thread-safe.  No additional locking is needed here.
"""

import time
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Tuple

import numpy as np

from .camera_stream import CameraStream
from .face_pipeline import FacePipeline, FaceResult
from .stability import StabilityDetector, StabilityResult

logger = logging.getLogger(__name__)

# Dedicated audit logger — operators can route this to a separate file/SIEM.
audit_logger = logging.getLogger(__name__ + ".audit")


# ── Configuration ──────────────────────────────────────────────────────────────

@dataclass
class VerifierConfig:
    """
    All tunable knobs for multi-frame verification and anti-tailgating.

    total_frames          — frames to sample per attempt; more = more robust.
    required_votes        — minimum frames agreeing on the same employee.
    frame_interval_s      — minimum gap between samples; adds temporal spread.
    frame_timeout_s       — hard deadline per attempt for frame collection.
    max_attempts          — how many times to restart after tailgating detected.
                            Set to 1 to never retry (fail immediately on tailgate).
    tailgating_cooldown_s — seconds to wait between attempts after tailgating,
                            giving the intruder time to leave the zone.
    """
    total_frames: int = 5
    required_votes: int = 3
    frame_interval_s: float = 0.08      # 80 ms ≈ slightly more than 1/15 fps
    frame_timeout_s: float = 4.0
    max_attempts: int = 3
    tailgating_cooldown_s: float = 2.0


# ── Result types ───────────────────────────────────────────────────────────────

@dataclass
class FrameDetail:
    """Per-frame recognition outcome in the VerificationResult breakdown."""
    frame_index: int        # 0-based index within this attempt
    attempt_number: int     # which attempt (1-based) this frame belongs to
    success: bool
    employee_id: Optional[str]
    similarity: float
    is_unknown: bool
    face_count: int         # zone-filtered face count from this frame
    tailgating: bool        # True when face_count > 1 caused an abort
    message: str


@dataclass
class VerificationResult:
    """
    Final outcome of a multi-frame verification (all attempts combined).

    confirmed               — True only when majority vote passes.
    employee_id             — set when confirmed=True.
    vote_count              — winning employee's frame count.
    total_sampled           — recognition frames processed across all attempts.
    required_votes          — config value echoed for response transparency.
    avg_similarity          — mean similarity of the winning employee's frames.
    attempt_number          — which attempt number produced the final result.
    tailgating_detected     — True if any attempt was aborted by tailgating.
    tailgating_frames       — total frames with face_count > 1.
    stability_frames_achieved — consecutive stable frames reached before
                               recognition; equals required when stable=True.
    stability_timed_out     — True when the stability gate timed out without
                               the face becoming still enough.
    frame_details           — per-recognition-frame breakdown.
    message                 — human-readable summary.
    """
    confirmed: bool
    employee_id: Optional[str] = None
    vote_count: int = 0
    total_sampled: int = 0
    required_votes: int = 0
    avg_similarity: float = 0.0
    attempt_number: int = 1
    tailgating_detected: bool = False
    tailgating_frames: int = 0
    stability_frames_achieved: int = 0
    stability_timed_out: bool = False
    frame_details: List[FrameDetail] = field(default_factory=list)
    message: str = ""


# ── Verifier ───────────────────────────────────────────────────────────────────

class MultiFrameVerifier:
    """
    Orchestrates stability gate → multi-frame recognition → majority vote
    with integrated anti-tailgating detection and automatic restart.

    Stability integration
    ---------------------
    When a StabilityDetector is provided, verify() runs a stability pre-gate
    before every recognition attempt:

      1. wait_for_stable() polls the camera buffer until the face bounding
         box moves less than movement_threshold_px for stable_frames_required
         consecutive frames (detection only, no embedding).
      2. If stability times out, verification fails immediately with
         stability_timed_out=True and message "Hold still for verification."
      3. On tailgating-triggered retries, stability is re-checked before
         the next attempt so the subject must re-stabilise after the intruder
         leaves.

    When stability_detector is None, the gate is skipped entirely and the
    system behaves exactly as before this enhancement.
    """

    def __init__(
        self,
        config: VerifierConfig,
        stability_detector: Optional[StabilityDetector] = None,
    ) -> None:
        if config.required_votes > config.total_frames:
            raise ValueError(
                f"required_votes ({config.required_votes}) cannot exceed "
                f"total_frames ({config.total_frames})."
            )
        self._cfg = config
        self._stability_detector = stability_detector
        logger.info(
            "MultiFrameVerifier ready. frames=%d  required=%d  "
            "interval=%.2fs  max_attempts=%d  stability=%s",
            config.total_frames,
            config.required_votes,
            config.frame_interval_s,
            config.max_attempts,
            "enabled" if stability_detector else "disabled",
        )

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def verify(
        self,
        camera: CameraStream,
        pipeline: FacePipeline,
    ) -> VerificationResult:
        """
        Run stability gate → multi-frame verification with tailgating restart.

        Full flow
        ---------
        For each attempt (up to max_attempts):
          1. Stability gate (if StabilityDetector is configured):
               poll frames until the face is still for stable_frames_required
               consecutive frames, or stability_timeout_s elapses.
               • Timeout → return immediately with stability_timed_out=True.
               • Success → proceed to recognition.
          2. Recognition attempt (_run_attempt):
               collect total_frames distinct frames, run pipeline on each,
               check for tailgating, accumulate votes.
          3. On tailgating:
               wait tailgating_cooldown_s, then restart from step 1.
               This ensures the subject must re-stabilise after the intruder
               leaves before recognition is retried.
          4. On non-tailgating result (confirmed / unknown / insufficient):
               return immediately.
        """
        all_frame_details: List[FrameDetail] = []
        total_tailgating_frames = 0
        # Will be set from the last stability result (if detector is enabled).
        last_stability: Optional[StabilityResult] = None
        cfg = self._cfg

        for attempt in range(1, cfg.max_attempts + 1):
            logger.info("=== Verification attempt %d/%d ===", attempt, cfg.max_attempts)

            # ── Step 1: Stability gate ─────────────────────────────────────
            # Runs before EVERY attempt (including retries after tailgating)
            # so the subject must be still after an intruder leaves.
            if self._stability_detector is not None:
                stab = self._stability_detector.wait_for_stable(camera, pipeline)
                last_stability = stab

                if not stab.stable:
                    # Stability timed out — the person kept moving.
                    # Return immediately; no recognition frames collected.
                    logger.warning(
                        "Stability gate timed out on attempt %d "
                        "(achieved %d/%d frames). Aborting.",
                        attempt,
                        stab.stable_frame_count,
                        stab.required_frames,
                    )
                    final = VerificationResult(
                        confirmed=False,
                        required_votes=cfg.required_votes,
                        attempt_number=attempt,
                        stability_frames_achieved=stab.stable_frame_count,
                        stability_timed_out=True,
                        tailgating_frames=total_tailgating_frames,
                        frame_details=all_frame_details,
                        message="Hold still for verification.",
                    )
                    return final

                logger.info(
                    "Stability confirmed (%d frames, %.2fs wait). "
                    "Proceeding to recognition.",
                    stab.stable_frame_count,
                    stab.wait_time_s,
                )

            # ── Step 2: Recognition attempt ────────────────────────────────
            result, frame_details = self._run_attempt(camera, pipeline, attempt)
            all_frame_details.extend(frame_details)
            tailgating_in_attempt = sum(1 for fd in frame_details if fd.tailgating)
            total_tailgating_frames += tailgating_in_attempt

            if result.tailgating_detected:
                remaining = cfg.max_attempts - attempt
                if remaining > 0:
                    logger.info(
                        "Tailgating aborted attempt %d. "
                        "Waiting %.1fs before retry (%d attempt(s) left).",
                        attempt,
                        cfg.tailgating_cooldown_s,
                        remaining,
                    )
                    time.sleep(cfg.tailgating_cooldown_s)
                    continue   # restart — stability will re-gate before next attempt
                else:
                    logger.warning(
                        "Tailgating detected on all %d attempt(s). Denied.",
                        cfg.max_attempts,
                    )

            # ── Step 3: Attach cross-attempt fields and return ─────────────
            result.frame_details = all_frame_details
            result.tailgating_frames = total_tailgating_frames
            result.attempt_number = attempt
            result.total_sampled = len(all_frame_details)
            result.stability_frames_achieved = (
                last_stability.stable_frame_count if last_stability else 0
            )
            result.stability_timed_out = False   # gate passed; timeout=False
            return result

        # Unreachable — all paths inside the loop return or continue.
        return VerificationResult(
            confirmed=False,
            required_votes=cfg.required_votes,
            frame_details=all_frame_details,
            tailgating_detected=True,
            tailgating_frames=total_tailgating_frames,
            message="Verification failed: tailgating detected on all attempts.",
        )

    # ------------------------------------------------------------------
    # Single attempt
    # ------------------------------------------------------------------

    def _run_attempt(
        self,
        camera: CameraStream,
        pipeline: FacePipeline,
        attempt_number: int,
    ) -> Tuple[VerificationResult, List[FrameDetail]]:
        """
        Collect frames and run recognition for one attempt.

        Frames are collected and processed ONE AT A TIME so that a tailgating
        detection on frame K aborts immediately — frames K+1 … N are never
        fetched or processed.  This is the key difference from the previous
        architecture (collect-all, then process-all).

        Returns
        -------
        (VerificationResult, List[FrameDetail])
            The result reflects only THIS attempt's frames.
            The caller (verify()) merges frame_details across attempts.
        """
        cfg = self._cfg
        face_results: List[FaceResult] = []
        frame_details: List[FrameDetail] = []
        last_seen_time: float = -1.0
        deadline = time.monotonic() + cfg.frame_timeout_s
        frame_index = 0

        while len(face_results) < cfg.total_frames:
            # ── Hard deadline ──────────────────────────────────────────────
            if time.monotonic() > deadline:
                logger.warning(
                    "Attempt %d: frame collection timed out — "
                    "collected %d of %d frames.",
                    attempt_number,
                    len(face_results),
                    cfg.total_frames,
                )
                break

            # ── Wait for a new distinct frame ──────────────────────────────
            frame, frame_time = camera.get_frame_with_time()
            if frame is None or frame_time <= last_seen_time:
                time.sleep(0.01)
                continue

            last_seen_time = frame_time
            frame_snapshot = frame.copy()   # stabilise reference before processing

            # ── Run full pipeline (detection + embedding + comparison) ──────
            result = pipeline.process(frame_snapshot)

            logger.debug(
                "Attempt %d, frame %d/%d: face_count=%d  success=%s",
                attempt_number,
                frame_index + 1,
                cfg.total_frames,
                result.face_count,
                result.success,
            )

            # ── Anti-tailgating check ──────────────────────────────────────
            # face_count is the number of faces whose centre is inside the
            # detection zone — populated by pipeline.process() at zero extra
            # detection cost.  Any count > 1 means a second person is present.
            if result.face_count > 1:
                detail = FrameDetail(
                    frame_index=frame_index,
                    attempt_number=attempt_number,
                    success=False,
                    employee_id=None,
                    similarity=0.0,
                    is_unknown=False,
                    face_count=result.face_count,
                    tailgating=True,
                    message=(
                        f"Multiple people detected ({result.face_count} faces "
                        "in zone). Please stand alone."
                    ),
                )
                frame_details.append(detail)
                self._log_tailgating_event(attempt_number, frame_index, result.face_count)

                # Abort this attempt immediately.
                return (
                    VerificationResult(
                        confirmed=False,
                        required_votes=cfg.required_votes,
                        tailgating_detected=True,
                        message=(
                            "Multiple people detected. Please stand alone."
                        ),
                    ),
                    frame_details,
                )

            # ── Accumulate valid frame ─────────────────────────────────────
            detail = FrameDetail(
                frame_index=frame_index,
                attempt_number=attempt_number,
                success=result.success,
                employee_id=result.employee_id,
                similarity=round(result.similarity, 4),
                is_unknown=result.is_unknown,
                face_count=result.face_count,
                tailgating=False,
                message=result.message,
            )
            frame_details.append(detail)
            face_results.append(result)
            self._log_frame_result(attempt_number, frame_index, cfg.total_frames, result)
            frame_index += 1

            # Wait before the next sample to add temporal spread.
            if len(face_results) < cfg.total_frames:
                time.sleep(cfg.frame_interval_s)

        # ── All frames collected cleanly — run majority vote ───────────────
        total_sampled = len(face_results)

        if total_sampled == 0:
            logger.warning("Attempt %d: no frames collected.", attempt_number)
            return (
                VerificationResult(
                    confirmed=False,
                    required_votes=cfg.required_votes,
                    message="No frames available from camera.",
                ),
                frame_details,
            )

        vote_result = self._vote(face_results, total_sampled, frame_details)
        return vote_result, frame_details

    # ------------------------------------------------------------------
    # Voting
    # ------------------------------------------------------------------

    def _vote(
        self,
        face_results: List[FaceResult],
        total_sampled: int,
        frame_details: List[FrameDetail],
    ) -> VerificationResult:
        """
        Tally per-employee votes and decide whether verification passes.

        Vote eligibility
        ----------------
        Only FaceResult objects with success=True contribute a vote.
        Frames where the pipeline found no face, flagged multiple faces,
        or scored below the similarity threshold do NOT vote.

        Decision table
        --------------
        | Scenario                               | confirmed |
        |----------------------------------------|-----------|
        | winner votes >= required_votes, no tie | True      |
        | winner votes < required_votes          | False     |
        | tie at the top vote count              | False     |
        | no successful frames at all            | False     |
        """
        cfg = self._cfg

        # Accumulate similarities per employee (only from successful frames).
        vote_similarities: Dict[str, List[float]] = defaultdict(list)
        for r in face_results:
            if r.success and r.employee_id:
                vote_similarities[r.employee_id].append(r.similarity)

        if not vote_similarities:
            logger.info(
                "VERIFICATION FAILED — no frame passed recognition "
                "(sampled=%d, successful=0).",
                total_sampled,
            )
            return VerificationResult(
                confirmed=False,
                total_sampled=total_sampled,
                required_votes=cfg.required_votes,
                message=(
                    f"No frame passed recognition out of {total_sampled} sampled. "
                    "Please face the camera directly."
                ),
            )

        # Sort by descending vote count.
        ranked = sorted(
            vote_similarities.items(),
            key=lambda kv: len(kv[1]),
            reverse=True,
        )
        winner_id, winner_sims = ranked[0]
        vote_count = len(winner_sims)

        tally_lines = [
            f"  {eid}: {len(sims)} vote(s)  avg_sim={sum(sims)/len(sims):.4f}"
            for eid, sims in ranked
        ]
        logger.info(
            "Vote tally (%d/%d frames with valid recognition):\n%s",
            sum(len(s) for s in vote_similarities.values()),
            total_sampled,
            "\n".join(tally_lines),
        )

        # ── Tie check ──────────────────────────────────────────────────────
        if len(ranked) >= 2 and len(ranked[1][1]) == vote_count:
            runner_up_id = ranked[1][0]
            logger.info(
                "VERIFICATION FAILED — tie: %s and %s both have %d vote(s).",
                winner_id,
                runner_up_id,
                vote_count,
            )
            return VerificationResult(
                confirmed=False,
                total_sampled=total_sampled,
                required_votes=cfg.required_votes,
                message=(
                    f"Ambiguous result: '{winner_id}' and '{runner_up_id}' "
                    f"both received {vote_count} vote(s). Could not confirm identity."
                ),
            )

        # ── Required-votes check ───────────────────────────────────────────
        if vote_count < cfg.required_votes:
            logger.info(
                "VERIFICATION FAILED — %s received %d/%d required votes.",
                winner_id,
                vote_count,
                cfg.required_votes,
            )
            return VerificationResult(
                confirmed=False,
                employee_id=winner_id,
                vote_count=vote_count,
                total_sampled=total_sampled,
                required_votes=cfg.required_votes,
                avg_similarity=sum(winner_sims) / len(winner_sims),
                message=(
                    f"Insufficient confirmation: '{winner_id}' matched in "
                    f"{vote_count} of {total_sampled} frames "
                    f"(need {cfg.required_votes})."
                ),
            )

        # ── Confirmed ──────────────────────────────────────────────────────
        avg_sim = sum(winner_sims) / len(winner_sims)
        logger.info(
            "VERIFICATION CONFIRMED — employee=%s  votes=%d/%d  avg_sim=%.4f",
            winner_id,
            vote_count,
            total_sampled,
            avg_sim,
        )
        return VerificationResult(
            confirmed=True,
            employee_id=winner_id,
            vote_count=vote_count,
            total_sampled=total_sampled,
            required_votes=cfg.required_votes,
            avg_similarity=round(avg_sim, 4),
        )

    # ------------------------------------------------------------------
    # Logging helpers
    # ------------------------------------------------------------------

    def _log_frame_result(
        self,
        attempt: int,
        frame_index: int,
        total: int,
        result: FaceResult,
    ) -> None:
        """Log one frame's recognition outcome at INFO level."""
        prefix = f"  Attempt {attempt}, frame {frame_index + 1}/{total}"
        if result.success:
            logger.info(
                "%s → MATCH  employee=%s  sim=%.4f",
                prefix, result.employee_id, result.similarity,
            )
        elif result.is_unknown:
            logger.info(
                "%s → UNKNOWN  best_sim=%.4f  (%s)",
                prefix, result.similarity, result.message,
            )
        else:
            logger.info("%s → NO FACE  (%s)", prefix, result.message)

    def _log_tailgating_event(
        self,
        attempt: int,
        frame_index: int,
        face_count: int,
    ) -> None:
        """
        Emit a WARNING on the audit logger for every tailgating detection.

        The audit logger (__name__ + '.audit') can be routed to a dedicated
        handler (separate log file, SIEM, alerting system) via logging config
        without changing any application code.

        Log fields
        ----------
        • timestamp  — provided by the logging framework
        • attempt    — which attempt was aborted
        • frame      — which frame index within the attempt triggered the abort
        • face_count — how many zone faces were detected (always > 1 here)
        """
        audit_logger.warning(
            "TAILGATING DETECTED | attempt=%d | frame=%d | zone_faces=%d | "
            "action=VERIFICATION_ABORTED",
            attempt,
            frame_index,
            face_count,
        )
