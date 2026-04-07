"""
correction_verifier.py
----------------------
Employee identity re-verification for the attendance correction workflow.

How the verification step integrates with the existing face recognition pipeline
--------------------------------------------------------------------------------
CorrectionVerifier.verify_for_edit() is a thin orchestration layer that calls
the **exact same** MultiFrameVerifier.verify() used by the normal attendance
mark endpoint.  No pipeline stages are modified or duplicated:

  ┌─────────────────────────────────────────────────────────────────────┐
  │  Normal attendance flow            Correction verification flow     │
  │  ────────────────────────          ────────────────────────────     │
  │  POST /mark_attendance             POST /admin/corrections/verify   │
  │          │                                   │                      │
  │          └── MultiFrameVerifier.verify()     │                      │
  │                    │           ←─────────────┘                      │
  │                    ├── StabilityDetector.wait_for_stable()          │
  │                    └── _run_attempt():                              │
  │                          pipeline.process(frame):                  │
  │                            LightingNormalizer.normalize()           │
  │                            _detect()  →  _count_zone_faces()        │
  │                            _validate()                              │
  │                            _crop_align()  →  _embed()               │
  │                            _compare()  (cosine similarity gate)     │
  │                          tailgating check                           │
  │                          majority vote                              │
  └─────────────────────────────────────────────────────────────────────┘

The correction verifier adds two steps AFTER the pipeline completes:

  Step A — Identity gate
    Normal attendance: any confirmed employee gets recorded.
    Correction:        confirmed employee MUST match the specific employee_id
                       being edited.  A different confirmed employee is treated
                       as a failure so one employee cannot impersonate another
                       to edit their own record.

  Step B — Photo proof capture
    The current frame is fetched from the camera buffer and written to
    `correction_verifications/` as a JPEG.  This image is linked to every
    correction audit row so there is photographic evidence of who stood in
    front of the camera at verification time.

Token-based handshake
---------------------
On success, verify_for_edit() issues a signed one-time token (a 32-byte
URL-safe random string) that encodes {employee_id, expires_at, image_path}.
The token is stored in _pending_tokens (module-level dict, protected by a
threading.Lock) until the edit endpoint consumes it.

  verify_for_edit(emp_id)  →  CorrectionVerificationResult(token=..., ...)
  consume_token(token, emp_id)  →  PendingVerification | None (if expired/wrong)

Single-use guarantee: consume_token() pops the token from _pending_tokens so
replaying the same token after a successful apply is impossible.
"""

import os
import time
import secrets
import threading
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict

import cv2
import numpy as np

from .camera_stream import CameraStream
from .face_pipeline import FacePipeline
from .verifier import MultiFrameVerifier, VerificationResult

logger = logging.getLogger(__name__)

# Dedicated audit logger for correction verification events.
_audit = logging.getLogger(__name__ + ".audit")

# Directory where verification JPEG images are saved.
VERIFICATION_IMAGE_DIR = "correction_verifications"

# How long a verification token remains valid (seconds).
# 5 minutes gives the admin time to fill in the form after the employee
# steps off-camera.
TOKEN_TTL_S = 300


# ── Pending token store (module-level, shared across all requests) ─────────────

@dataclass
class PendingVerification:
    """
    One valid but unconsumed verification token.

    Fields
    ------
    employee_id          — the employee who was verified.
    expires_at           — unix timestamp after which the token is invalid.
    verification_ts      — when verification completed (for the audit log).
    image_path           — path to the saved JPEG photo proof.
    avg_similarity       — confidence score from the pipeline run.
    """
    employee_id:     str
    expires_at:      float
    verification_ts: float
    image_path:      str
    avg_similarity:  float


# Protected by _token_lock.  Do not access directly outside this module.
_pending_tokens: Dict[str, PendingVerification] = {}
_token_lock = threading.Lock()


def consume_token(token: str, employee_id: str) -> Optional[PendingVerification]:
    """
    Validate and consume a verification token.

    Single-use guarantee
    --------------------
    The token is removed from _pending_tokens whether it is valid or not,
    so replaying an already-consumed token or attempting to use a valid token
    for the wrong employee both fail and leave no token in the store.

    Returns
    -------
    PendingVerification — if the token exists, has not expired, and matches
                          the claimed employee_id.
    None                — on any failure (expired, wrong employee, not found).
    """
    with _token_lock:
        pv = _pending_tokens.pop(token, None)

    if pv is None:
        logger.warning("consume_token: token not found or already used.")
        return None

    if time.time() > pv.expires_at:
        logger.warning(
            "consume_token: token for %s has expired.", pv.employee_id
        )
        return None

    if pv.employee_id != employee_id:
        logger.warning(
            "consume_token: token is for %s but claimed employee is %s.",
            pv.employee_id,
            employee_id,
        )
        return None

    return pv


def _purge_expired_tokens() -> None:
    """
    Remove all expired tokens from the pending store.

    Called inside verify_for_edit() before issuing a new token so the dict
    does not grow unboundedly if the apply step is never called.  This is an
    O(N) scan; with at most one verification in flight per admin seat, N is
    always tiny.
    """
    now = time.time()
    with _token_lock:
        expired = [t for t, pv in _pending_tokens.items() if now > pv.expires_at]
        for t in expired:
            del _pending_tokens[t]
    if expired:
        logger.debug("Purged %d expired verification token(s).", len(expired))


# ── Result types ───────────────────────────────────────────────────────────────

@dataclass
class CorrectionVerificationResult:
    """
    Outcome of a camera re-verification attempt for attendance correction.

    Fields
    ------
    success         — True only when the confirmed employee matches employee_id.
    token           — one-time token to authorise the edit (only when success).
    expires_at      — unix timestamp when the token expires (only when success).
    employee_id     — the employee that was requested.
    detected_id     — who the camera actually recognised (may differ on mismatch).
    avg_similarity  — confidence from the multi-frame vote.
    image_path      — path to the saved verification JPEG (only when success).
    message         — human-readable outcome description.
    vr              — the raw VerificationResult from MultiFrameVerifier.
    """
    success:        bool
    token:          Optional[str]    = None
    expires_at:     Optional[float]  = None
    employee_id:    str              = ""
    detected_id:    Optional[str]    = None
    avg_similarity: float            = 0.0
    image_path:     str              = ""
    message:        str              = ""
    vr:             Optional[VerificationResult] = None


# ── Main verifier ──────────────────────────────────────────────────────────────

class CorrectionVerifier:
    """
    Runs camera re-verification and issues an edit token on success.

    This class owns no pipeline state.  It is a thin coordinator around the
    shared MultiFrameVerifier, CameraStream, and FacePipeline instances that
    are already running for the normal attendance flow.

    Design principle: reuse, don't replicate
    ----------------------------------------
    MultiFrameVerifier.verify() already handles:
      • stability pre-gate
      • multi-frame collection at the configured frame_interval_s
      • tailgating detection and restart
      • majority-vote confirmation
      • similarity threshold gating

    CorrectionVerifier adds only the correction-specific concerns:
      • employee identity gate (confirmed == requested employee)
      • verification image capture and persistence
      • token issuance and expiry management
    """

    def __init__(
        self,
        verifier: MultiFrameVerifier,
        camera:   CameraStream,
        pipeline: FacePipeline,
        image_dir: str = VERIFICATION_IMAGE_DIR,
        token_ttl_s: float = TOKEN_TTL_S,
    ) -> None:
        """
        Args:
            verifier    — the shared MultiFrameVerifier instance (same one
                          used by POST /mark_attendance).
            camera      — the shared CameraStream for frame capture.
            pipeline    — the shared FacePipeline for image encoding only
                          (the pipeline is run by MultiFrameVerifier internally).
            image_dir   — directory for verification JPEG images.
                          Created automatically on first use.
            token_ttl_s — seconds a token stays valid after issuance.
        """
        self._verifier = verifier
        self._camera = camera
        self._pipeline = pipeline
        self._image_dir = image_dir
        self._token_ttl_s = token_ttl_s
        os.makedirs(image_dir, exist_ok=True)
        logger.info(
            "CorrectionVerifier ready. image_dir=%s  token_ttl=%ds",
            image_dir,
            token_ttl_s,
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    def verify_for_edit(self, employee_id: str) -> CorrectionVerificationResult:
        """
        Run the full multi-frame verification pipeline for attendance editing.

        Verification flow
        -----------------
        1. Run MultiFrameVerifier.verify(camera, pipeline) — this is identical
           to the call inside POST /mark_attendance.  All stages run:
             StabilityDetector → _run_attempt → pipeline.process (per frame) →
             tailgating check → majority vote → similarity threshold gate.

        2. If verification is not confirmed (unknown person, insufficient votes,
           tailgating, stability timeout):
             → Return failure with the pipeline's own message.

        3. If confirmed but the recognised employee_id ≠ requested employee_id:
             → Identity gate failure.
             → This catches a different employee standing in front of the camera
               to approve editing someone else's record.

        4. If confirmed AND employee matches:
             → Capture the current camera frame as photo proof.
             → Save JPEG to correction_verifications/{employee_id}_{ts_ms}.jpg.
             → Issue a one-time token valid for token_ttl_s seconds.
             → Return success with token and image_path.

        Args:
            employee_id: The employee whose attendance record the admin wants
                         to edit.  The camera must recognise this exact employee.

        Returns:
            CorrectionVerificationResult with success=True and a token if the
            employee was confirmed, or success=False with a reason message.
        """
        _purge_expired_tokens()

        logger.info(
            "Correction verification started for employee=%s.", employee_id
        )

        # ── Step 1: Run the full face recognition pipeline ─────────────────
        # This is THE SAME call as in mark_attendance — no stages are skipped
        # or modified.  All pipeline configuration (thresholds, frame count,
        # stability settings) remains as configured at startup.
        vr: VerificationResult = self._verifier.verify(self._camera, self._pipeline)

        # ── Step 2: Pipeline-level failure ─────────────────────────────────
        if not vr.confirmed:
            _audit.warning(
                "CORRECTION VERIFY FAILED (pipeline): employee=%s  reason=%r",
                employee_id,
                vr.message,
            )
            return CorrectionVerificationResult(
                success=False,
                employee_id=employee_id,
                detected_id=vr.employee_id,
                avg_similarity=vr.avg_similarity,
                message=f"Employee verification failed: {vr.message}",
                vr=vr,
            )

        # ── Step 3: Identity gate ──────────────────────────────────────────
        # The pipeline confirmed *someone*, but is it the right person?
        # vr.employee_id is who the camera recognised; employee_id is who the
        # admin requested to edit.  These must match.
        if vr.employee_id != employee_id:
            logger.warning(
                "Correction identity gate FAILED: requested=%s  detected=%s  "
                "sim=%.4f  — refusing to issue edit token.",
                employee_id,
                vr.employee_id,
                vr.avg_similarity,
            )
            _audit.warning(
                "CORRECTION VERIFY FAILED (identity mismatch): "
                "requested=%s  detected=%s  sim=%.4f",
                employee_id,
                vr.employee_id,
                vr.avg_similarity,
            )
            return CorrectionVerificationResult(
                success=False,
                employee_id=employee_id,
                detected_id=vr.employee_id,
                avg_similarity=vr.avg_similarity,
                message=(
                    f"Employee verification failed: camera identified "
                    f"'{vr.employee_id}', not '{employee_id}'."
                ),
                vr=vr,
            )

        # ── Step 4: Capture verification image ─────────────────────────────
        # Grab the latest frame from the camera buffer.  The employee is still
        # standing in front of the camera (verification just finished), so this
        # frame is a valid photo-proof of who was present.
        image_path = self._capture_verification_image(employee_id)

        # ── Step 5: Issue one-time edit token ──────────────────────────────
        token = secrets.token_urlsafe(32)
        verification_ts = time.time()
        expires_at = verification_ts + self._token_ttl_s

        pv = PendingVerification(
            employee_id=employee_id,
            expires_at=expires_at,
            verification_ts=verification_ts,
            image_path=image_path,
            avg_similarity=vr.avg_similarity,
        )
        with _token_lock:
            _pending_tokens[token] = pv

        logger.info(
            "Correction verification PASSED: employee=%s  sim=%.4f  "
            "image=%s  token_expires=%s",
            employee_id,
            vr.avg_similarity,
            image_path,
            time.strftime("%H:%M:%S", time.localtime(expires_at)),
        )
        _audit.info(
            "CORRECTION VERIFY SUCCESS: employee=%s  sim=%.4f  "
            "votes=%d/%d  image=%s",
            employee_id,
            vr.avg_similarity,
            vr.vote_count,
            vr.total_sampled,
            image_path,
        )

        return CorrectionVerificationResult(
            success=True,
            token=token,
            expires_at=expires_at,
            employee_id=employee_id,
            detected_id=vr.employee_id,
            avg_similarity=vr.avg_similarity,
            image_path=image_path,
            message=(
                f"Identity confirmed. Similarity: {vr.avg_similarity:.2%}. "
                f"You may now edit the attendance record."
            ),
            vr=vr,
        )

    # ── Internal helpers ────────────────────────────────────────────────────────

    def _capture_verification_image(self, employee_id: str) -> str:
        """
        Grab the current camera frame and save it as a JPEG.

        Photo proof
        -----------
        The image filename encodes the employee_id and a millisecond timestamp
        so files from multiple corrections on the same employee are never
        overwritten.  The directory is created in __init__ so this method has
        no filesystem side-effects beyond writing the one JPEG.

        Returns
        -------
        The path to the saved file (relative to the working directory), or an
        empty string if the camera frame is unavailable.  An empty path is
        non-fatal — the correction can still proceed but the audit record will
        note that image capture failed.
        """
        frame = self._camera.get_frame()
        if frame is None:
            logger.warning(
                "Could not capture verification image for %s — no frame available.",
                employee_id,
            )
            return ""

        ts_ms = int(time.time() * 1000)
        # Sanitise employee_id for use in a filename (replace unsafe chars).
        safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in employee_id)
        filename = f"{safe_id}_{ts_ms}.jpg"
        path = os.path.join(self._image_dir, filename)

        success, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not success:
            logger.warning("cv2.imencode failed for employee %s.", employee_id)
            return ""

        with open(path, "wb") as fh:
            fh.write(buf.tobytes())

        logger.info("Verification image saved: %s", path)
        return path
