"""
app.py
------
FastAPI application that wires together CameraStream, FacePipeline, and
AttendanceStore.

Request flow for POST /mark_attendance
  1. Retrieve the latest frame from the in-memory CameraStream buffer.
     → No RTSP connection is opened here; it's always the background thread.
  2. Run the full FacePipeline (detect → validate → crop → embed → compare).
  3. Confidence gate: if similarity < threshold, return unknown rejection.
  4. If matched, write an AttendanceRecord (with cooldown guard).
  5. Return a JSON response including top-match candidates.

Run with:
    uvicorn attendance_system.app:app --reload --port 8000
"""

import os
import time
import logging
import logging.config
import threading
from contextlib import asynccontextmanager
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

from .camera_stream import CameraStream, CameraConfig
from .face_pipeline import FacePipeline, FaceResult, PipelineConfig, EmbeddingCache, MatchCandidate
from .attendance_store import AttendanceStore, AttendanceRecord, ShiftConfig, EntryType, AttendanceStatus
from .absence_scheduler import AbsenceScheduler, AbsenceSchedulerConfig
from .verifier import MultiFrameVerifier, VerifierConfig, VerificationResult
from .stability import StabilityDetector, StabilityConfig
from .holiday_store import HolidayStore
from .admin_dashboard import make_holiday_router
from .correction_store import CorrectionStore
from .correction_verifier import CorrectionVerifier, consume_token

# ── Logging setup ──────────────────────────────────────────────────────────────

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s [%(levelname)s] %(name)s — %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "root": {"level": "INFO", "handlers": ["console"]},
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


# ── Application state (module-level singletons) ────────────────────────────────

camera: Optional[CameraStream] = None
pipeline: Optional[FacePipeline] = None
verifier: Optional[MultiFrameVerifier] = None
store: Optional[AttendanceStore] = None
absence_scheduler: Optional[AbsenceScheduler] = None
# HolidayStore is initialised during lifespan startup and persisted across
# requests in this module-level variable.  It is passed to AbsenceScheduler
# so the daily absence job can skip public holidays automatically.
holiday_store: Optional[HolidayStore] = None
# CorrectionVerifier orchestrates camera re-verification for attendance edits.
# CorrectionStore persists every edit as an immutable audit row.
correction_verifier: Optional[CorrectionVerifier] = None
correction_store: Optional[CorrectionStore] = None

# Last verification result — written by /mark_attendance, read by /recognition/last.
# Protected by _last_result_lock so concurrent requests don't race.
_last_result: Optional[VerificationResult] = None
_last_result_lock = threading.Lock()


# ── Lifespan: start/stop background resources ──────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    Everything before `yield` runs at startup; everything after at shutdown.
    """
    global camera, pipeline, store, absence_scheduler, holiday_store, \
           correction_verifier, correction_store

    # ── Camera: start background thread ───────────────────────────────────
    rtsp_url = os.environ.get("RTSP_URL", "rtsp://admin:password@192.168.1.100/stream1")
    cam_cfg = CameraConfig(
        rtsp_url=rtsp_url,
        reconnect_delay=3.0,
        stale_frame_timeout=5.0,
        target_fps=15.0,
    )
    camera = CameraStream(cam_cfg)

    # Wait up to 15 s for the first frame before serving requests.
    if camera.wait_for_connection(timeout=15.0):
        logger.info("Camera stream is live.")
    else:
        # Non-fatal: requests will return 503 until the stream comes up.
        logger.warning("Camera stream not yet live — will serve requests anyway.")

    # ── Embedding cache: load known employees ─────────────────────────────
    cache = EmbeddingCache()
    _seed_demo_embeddings(cache)        # replace with DB load in production

    # ── Face pipeline ─────────────────────────────────────────────────────
    pipeline = FacePipeline(
        PipelineConfig(
            similarity_threshold=float(os.environ.get("SIMILARITY_THRESHOLD", "0.75")),
            top_matches_count=int(os.environ.get("TOP_MATCHES_COUNT", "3")),
        ),
        cache,
    )

    # ── Stability detector (optional — disabled when STABILITY_ENABLED=0) ─
    stability_enabled = os.environ.get("STABILITY_ENABLED", "1") != "0"
    stability_detector: Optional[StabilityDetector] = None
    if stability_enabled:
        stability_detector = StabilityDetector(
            StabilityConfig(
                stable_frames_required=int(
                    os.environ.get("STABILITY_REQUIRED_FRAMES", "10")
                ),
                movement_threshold_px=float(
                    os.environ.get("STABILITY_THRESHOLD_PX", "15.0")
                ),
                movement_threshold_fraction=float(
                    os.environ.get("STABILITY_THRESHOLD_FRACTION", "0.0")
                ),
                stability_timeout_s=float(
                    os.environ.get("STABILITY_TIMEOUT_S", "10.0")
                ),
                poll_interval_s=float(
                    os.environ.get("STABILITY_POLL_INTERVAL_S", "0.05")
                ),
            )
        )

    # ── Multi-frame verifier ──────────────────────────────────────────────
    verifier = MultiFrameVerifier(
        VerifierConfig(
            total_frames=int(os.environ.get("VERIFY_TOTAL_FRAMES", "5")),
            required_votes=int(os.environ.get("VERIFY_REQUIRED_VOTES", "3")),
            frame_interval_s=float(os.environ.get("VERIFY_FRAME_INTERVAL_S", "0.08")),
            frame_timeout_s=float(os.environ.get("VERIFY_FRAME_TIMEOUT_S", "4.0")),
            max_attempts=int(os.environ.get("VERIFY_MAX_ATTEMPTS", "3")),
            tailgating_cooldown_s=float(os.environ.get("VERIFY_TAILGATING_COOLDOWN_S", "2.0")),
        ),
        stability_detector=stability_detector,
    )

    # ── Attendance store ──────────────────────────────────────────────────
    # The store manages per-employee, per-day check-in/check-out state.
    # The default_shift applies to any employee without an individual shift.
    # In production, load shift configs from a database instead of seeding.
    import datetime as _dt
    store = AttendanceStore(
        default_shift=ShiftConfig(
            shift_start=_dt.time(9, 0),
            shift_end=_dt.time(18, 0),
            grace_period_minutes=10,
            overtime_threshold_minutes=30,
        )
    )
    _seed_demo_shifts(store)

    # ── Holiday store ─────────────────────────────────────────────────────
    # HolidayStore uses a local SQLite file so holidays persist across server
    # restarts without any additional infrastructure.  The database file is
    # created automatically on first use.
    #
    # The store is passed into the admin router (so the HTML UI can read and
    # mutate holidays) and into the AbsenceScheduler (so daily absence checks
    # skip public holidays automatically).
    holiday_db_path = os.environ.get("HOLIDAY_DB_PATH", "holidays.db")
    holiday_store = HolidayStore(db_path=holiday_db_path)
    logger.info("HolidayStore initialised at %s.", holiday_db_path)

    # Register the admin holiday router now that holiday_store is ready.
    # include_router() is called inside lifespan so the factory can receive
    # the fully initialised store instance rather than relying on a global.
    app.include_router(make_holiday_router(holiday_store))

    # ── Absence scheduler ─────────────────────────────────────────────────
    # The scheduler fires once per day at `absence_check_time` (default 12:00).
    # It iterates over all enrolled employees (from the EmbeddingCache) and
    # marks absent those who have no check-in record and whose absence window
    # (shift_start + hours_after_shift_start) has elapsed.
    #
    # get_employee_ids is passed as a lambda so the scheduler always calls
    # cache.list_ids() at job-execution time — newly enrolled employees are
    # picked up automatically without restarting the server.
    #
    # holiday_store is passed so the scheduler can call is_holiday(date)
    # before iterating employees.  On a holiday the run returns immediately
    # with an empty list and no Absent records are written.
    import datetime as _dt
    absence_scheduler = AbsenceScheduler(
        config=AbsenceSchedulerConfig(
            absence_check_time=_dt.time(
                int(os.environ.get("ABSENCE_CHECK_HOUR", "12")),
                int(os.environ.get("ABSENCE_CHECK_MINUTE", "0")),
            ),
            hours_after_shift_start=float(
                os.environ.get("ABSENCE_HOURS_AFTER_START", "3.0")
            ),
            run_on_startup=os.environ.get("ABSENCE_RUN_ON_STARTUP", "1") != "0",
        ),
        store=store,
        get_employee_ids=lambda: cache.list_ids(),
        holiday_store=holiday_store,
    )
    absence_scheduler.start()

    # ── Correction audit store ────────────────────────────────────────────
    # CorrectionStore persists one row per attendance edit, including the
    # original timestamps, the new timestamps, the admin who made the change,
    # the verification timestamp, and the path to the captured JPEG.
    correction_db_path = os.environ.get("CORRECTION_DB_PATH", "corrections.db")
    correction_store = CorrectionStore(db_path=correction_db_path)
    logger.info("CorrectionStore initialised at %s.", correction_db_path)

    # ── Correction verifier ───────────────────────────────────────────────
    # CorrectionVerifier wraps the shared MultiFrameVerifier (the same object
    # used by /mark_attendance) with an identity gate and token issuance.
    # It receives the already-constructed verifier, camera, and pipeline so
    # no additional face-recognition resources are allocated.
    correction_verifier = CorrectionVerifier(
        verifier=verifier,
        camera=camera,
        pipeline=pipeline,
        image_dir=os.environ.get("CORRECTION_IMAGE_DIR", "correction_verifications"),
        token_ttl_s=float(os.environ.get("CORRECTION_TOKEN_TTL", "300")),
    )
    logger.info("CorrectionVerifier initialised.")

    yield  # ← application runs here

    # ── Shutdown ──────────────────────────────────────────────────────────
    if absence_scheduler:
        absence_scheduler.stop()
    if camera:
        camera.stop()
    logger.info("Shutdown complete.")


def _seed_demo_embeddings(cache: EmbeddingCache) -> None:
    """
    Populate the cache with fake embeddings for local testing.
    Replace with a real DB query in production.
    """
    rng = np.random.default_rng(42)
    for i, eid in enumerate(["EMP001", "EMP002", "EMP003"]):
        vec = rng.standard_normal(128).astype(np.float32)
        cache.add(eid, vec)
        logger.info("Seeded embedding for %s.", eid)


def _seed_demo_shifts(store: AttendanceStore) -> None:
    """
    Register per-employee shift configs for local testing.

    In production, replace this with a database query that loads shifts for
    all active employees at startup.  Shifts can also be added at runtime via
    store.add_shift() without restarting the server.

    Shift layout for the three demo employees:
      EMP001 — standard 09:00–18:00, 10-min grace (default)
      EMP002 — early shift 07:00–16:00, 5-min grace (strict)
      EMP003 — late shift  12:00–21:00, 15-min grace (flexible)
    """
    import datetime as _dt

    store.add_shift(
        "EMP001",
        ShiftConfig(
            shift_start=_dt.time(9, 0),
            shift_end=_dt.time(18, 0),
            grace_period_minutes=10,
            overtime_threshold_minutes=30,
        ),
    )
    store.add_shift(
        "EMP002",
        ShiftConfig(
            shift_start=_dt.time(7, 0),
            shift_end=_dt.time(16, 0),
            grace_period_minutes=5,
            overtime_threshold_minutes=20,
        ),
    )
    store.add_shift(
        "EMP003",
        ShiftConfig(
            shift_start=_dt.time(12, 0),
            shift_end=_dt.time(21, 0),
            grace_period_minutes=15,
            overtime_threshold_minutes=45,
        ),
    )
    logger.info("Demo shift configs seeded for EMP001, EMP002, EMP003.")


# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(title="Face Attendance API", lifespan=lifespan)




# ── Models ─────────────────────────────────────────────────────────────────────

class MatchCandidateOut(BaseModel):
    employee_id: str
    similarity: float


class FrameDetailOut(BaseModel):
    """Per-frame recognition result included in every attendance response."""
    frame_index: int
    attempt_number: int = 1
    success: bool
    employee_id: Optional[str] = None
    similarity: float = 0.0
    is_unknown: bool = False
    face_count: int = 0         # zone-filtered faces detected in this frame
    tailgating: bool = False    # True when face_count > 1 aborted the attempt
    message: str = ""


class AttendanceResponse(BaseModel):
    success: bool
    employee_id: Optional[str] = None
    avg_similarity: float = 0.0
    vote_count: int = 0
    total_sampled: int = 0
    required_votes: int = 0
    attempt_number: int = 1
    is_unknown: bool = False
    tailgating_detected: bool = False
    tailgating_frames: int = 0
    stability_frames_achieved: int = 0   # consecutive stable frames before recognition
    stability_timed_out: bool = False    # True when face wouldn't stay still
    message: str
    timestamp: Optional[float] = None
    frame_details: List[FrameDetailOut] = []

    # ── Shift-aware attendance fields ─────────────────────────────────────
    # Populated only when success=True (a check-in or check-out was recorded).
    entry_type: Optional[str] = None         # "Check-In" or "Check-Out"
    check_in_time: Optional[float] = None    # unix timestamp of today's check-in
    check_out_time: Optional[float] = None   # unix timestamp of today's check-out
    attendance_status: Optional[str] = None  # "On Time" | "Late" | "Early Leave" | "Overtime"
    late_minutes: int = 0                    # > 0 when attendance_status == "Late"


class RecognitionDebugResponse(BaseModel):
    """Full per-frame breakdown of the most recent verification — for tuning."""
    has_result: bool
    confirmed: bool = False
    employee_id: Optional[str] = None
    avg_similarity: float = 0.0
    vote_count: int = 0
    total_sampled: int = 0
    required_votes: int = 0
    attempt_number: int = 1
    tailgating_detected: bool = False
    tailgating_frames: int = 0
    stability_frames_achieved: int = 0
    stability_timed_out: bool = False
    message: str = ""
    frame_details: List[FrameDetailOut] = []


# ── Endpoints ──────────────────────────────────────────────────────────────────

def _frame_details_out(vr: VerificationResult) -> List[FrameDetailOut]:
    return [
        FrameDetailOut(
            frame_index=fd.frame_index,
            attempt_number=fd.attempt_number,
            success=fd.success,
            employee_id=fd.employee_id,
            similarity=fd.similarity,
            is_unknown=fd.is_unknown,
            face_count=fd.face_count,
            tailgating=fd.tailgating,
            message=fd.message,
        )
        for fd in vr.frame_details
    ]


@app.post("/mark_attendance", response_model=AttendanceResponse)
async def mark_attendance() -> AttendanceResponse:
    """
    Trigger attendance marking via multi-frame majority-vote verification.

    Steps:
      1. Confirm camera is connected.
      2. Run MultiFrameVerifier:
           a. Collect `total_frames` distinct frames from the buffer.
           b. Run FacePipeline on each frame independently.
           c. Tally votes; require `required_votes` agreement to confirm.
      3. If confirmed, record check-in or check-out via AttendanceStore
         (check-in/check-out state machine prevents duplicates).
      4. Return result with per-frame breakdown and shift-aware status fields.

    The endpoint is synchronous from the client's perspective but internally
    spans ~0.5–1 s while frames are collected and processed.  For production,
    consider running the verifier in a thread pool executor to avoid blocking
    the asyncio event loop during the collection window.
    """
    global _last_result

    # ── Step 1: Camera health check ───────────────────────────────────────
    if camera is None or not camera.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Camera stream is not available. Please try again shortly.",
        )

    if camera.get_frame() is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No frame available yet. Camera may still be connecting.",
        )

    # ── Step 2: Multi-frame verification ──────────────────────────────────
    # This call blocks for ~frame_interval_s * total_frames while collecting
    # frames, then runs the pipeline on each one sequentially.
    vr = verifier.verify(camera, pipeline)

    # Persist for /recognition/last debug endpoint.
    with _last_result_lock:
        _last_result = vr

    details_out = _frame_details_out(vr)
    common_fields = dict(
        total_sampled=vr.total_sampled,
        required_votes=vr.required_votes,
        vote_count=vr.vote_count,
        avg_similarity=vr.avg_similarity,
        attempt_number=vr.attempt_number,
        tailgating_detected=vr.tailgating_detected,
        tailgating_frames=vr.tailgating_frames,
        stability_frames_achieved=vr.stability_frames_achieved,
        stability_timed_out=vr.stability_timed_out,
        frame_details=details_out,
    )

    # ── Verification failed (unknown, insufficient votes, or tailgating) ──
    if not vr.confirmed:
        return AttendanceResponse(
            success=False,
            employee_id=vr.employee_id,
            is_unknown=not vr.tailgating_detected,
            message=vr.message,
            **common_fields,
        )

    # ── Step 3: Record attendance (check-in or check-out) ─────────────────
    # store.record() implements the check-in/check-out state machine:
    #   • No record today  → creates a check-in record, evaluates late status.
    #   • Check-in exists  → updates with check-out time, evaluates early-leave
    #                        or overtime status.
    #   • Both recorded    → returns None (prevents duplicate writes).
    result = store.record(
        employee_id=vr.employee_id,
        confidence=vr.avg_similarity,
    )

    if result is None:
        # Both check-in and check-out are already on file for today.
        # The employee's attendance is fully recorded; no further action needed.
        return AttendanceResponse(
            success=False,
            employee_id=vr.employee_id,
            message=(
                "Attendance already fully recorded for today "
                "(check-in and check-out both logged)."
            ),
            **common_fields,
        )

    # ── Step 4: Build response with shift-aware attendance fields ──────────
    rec = result.record
    entry_type = result.entry_type

    # Choose a human-readable message that tells the employee what was recorded.
    if entry_type == EntryType.CHECK_IN:
        if rec.check_in_status == "Late":
            msg = (
                f"Check-in recorded — {rec.late_minutes} minute(s) late "
                f"(status: {rec.check_in_status})."
            )
        else:
            msg = f"Check-in recorded on time."
    else:
        msg = f"Check-out recorded — status: {rec.status}."

    return AttendanceResponse(
        success=True,
        employee_id=rec.employee_id,
        message=msg,
        # check_in_time doubles as the timestamp field for backward compatibility.
        timestamp=rec.check_in_time,
        # Shift-aware fields — shown on the dashboard.
        entry_type=entry_type,
        check_in_time=rec.check_in_time,
        check_out_time=rec.check_out_time,
        attendance_status=rec.status,
        late_minutes=rec.late_minutes,
        **common_fields,
    )


@app.get("/camera/status")
async def camera_status() -> dict:
    """Returns the current camera connection status."""
    return {
        "connected": camera.is_connected() if camera else False,
        "has_frame": (camera.get_frame() is not None) if camera else False,
    }


@app.get("/attendance/records")
async def get_records() -> dict:
    """
    Returns all recorded attendance entries across all employees and dates.

    Each entry includes check-in time, check-out time, attendance status, and
    late_minutes so the dashboard can display a full shift-aware summary.

    Dashboard integration notes
    ---------------------------
    • attendance_status  — use this for colour-coded status badges:
                           "On Time" → green, "Late" → amber,
                           "Early Leave" → orange, "Overtime" → blue,
                           "Absent" → red, "Holiday" → gold.
    • check_in_time / check_out_time  — unix timestamps; format client-side
                                         with the user's local timezone.
    • late_minutes       — show as "+Nm late" when > 0 alongside check-in time.
    • check_out_time is null when the employee has not yet checked out.

    Reports integration — Holiday status
    -------------------------------------
    When a record has is_absent=True and a HolidayStore is available, this
    endpoint checks whether the record's date is a public holiday.  If so,
    `attendance_status` is overridden to "Holiday" and `is_holiday` is set to
    True.  This means the record is surfaced in reports as "Holiday" rather
    than "Absent", so administrators can distinguish legitimate absences from
    days when the whole organisation was off.

    The original `is_absent` field is preserved so callers can still
    distinguish the two cases if needed.
    """
    records = store.get_all() if store else []

    def _status_for(r: AttendanceRecord) -> str:
        """
        Return the display status for a record, substituting "Holiday" for
        "Absent" on public holiday dates.

        How this works
        --------------
        1. If the record is not absent, return its normal status unchanged.
        2. If the record is absent AND a HolidayStore is configured AND the
           record's date is a holiday, return "Holiday" instead of "Absent".
        3. Otherwise, return "Absent" as normal.
        """
        if not r.is_absent:
            return r.status
        if holiday_store is not None and holiday_store.is_holiday(r.date):
            return "Holiday"
        return r.status

    return {
        "count": len(records),
        "records": [
            {
                "employee_id":       r.employee_id,
                "date":              r.date,
                "check_in_time":     r.check_in_time,
                "check_out_time":    r.check_out_time,
                "attendance_status": _status_for(r),
                "check_in_status":   r.check_in_status,
                "check_out_status":  r.check_out_status,
                "late_minutes":      r.late_minutes,
                "is_absent":         r.is_absent,
                # is_holiday is True when attendance_status == "Holiday",
                # giving downstream consumers a stable boolean flag without
                # needing to string-compare attendance_status.
                "is_holiday": (
                    r.is_absent
                    and holiday_store is not None
                    and holiday_store.is_holiday(r.date)
                ),
                "confidence":  round(r.confidence, 3),
                "note":        r.note,
            }
            for r in records
        ],
    }


@app.get("/attendance/today")
async def get_today_records() -> dict:
    """
    Returns today's attendance records for all employees.

    Useful for a live dashboard view showing who has checked in,
    who has checked out, and the current attendance status for each person.
    """
    records = store.get_today() if store else []
    return {
        "date":  __import__("datetime").date.today().isoformat(),
        "count": len(records),
        "records": [
            {
                "employee_id":       r.employee_id,
                "check_in_time":     r.check_in_time,
                "check_out_time":    r.check_out_time,
                "attendance_status": r.status,
                "late_minutes":      r.late_minutes,
                "is_absent":         r.is_absent,
                "is_complete":       r.is_complete,
            }
            for r in records
        ],
    }


@app.get("/attendance/absent")
async def get_absent_records() -> dict:
    """
    Returns all attendance records where the employee was marked Absent.

    Dashboard integration
    ---------------------
    Use this endpoint to populate the "Absences" tab or to highlight employees
    who never checked in.  The `date` field allows filtering by day client-side.

    A record appears here when:
      • AbsenceScheduler fired and found no check-in after the absence deadline.
      • A manual POST /attendance/trigger-absence-check was called.
    Records are never created by the face-recognition pipeline itself.
    """
    records = store.get_all() if store else []
    absent = [r for r in records if r.is_absent]
    return {
        "count": len(absent),
        "records": [
            {
                "employee_id": r.employee_id,
                "date":        r.date,
                "status":      r.status,
                "note":        r.note,
            }
            for r in absent
        ],
    }


@app.post("/attendance/trigger-absence-check")
async def trigger_absence_check(date: Optional[str] = None) -> dict:
    """
    Manually trigger the absence check for a specific date.

    This is the same logic the scheduler runs daily, exposed as an API endpoint
    so operators can:
      • Back-fill absences for a missed scheduler run.
      • Test the absence logic without waiting for the scheduled trigger.
      • Re-check a past date after an employee dispute.

    Args (query parameter):
        date: "YYYY-MM-DD".  Defaults to today in local time.
              Example: GET /attendance/trigger-absence-check?date=2026-04-05

    Returns:
        newly_absent — list of employee IDs marked absent in this run.
        already_present / already_absent counts for transparency.

    The check is idempotent: running it twice produces no extra records.
    """
    if absence_scheduler is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Absence scheduler not initialised.",
        )
    import datetime as _dt
    # Validate date format if provided.
    if date is not None:
        try:
            _dt.date.fromisoformat(date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid date format '{date}'. Expected YYYY-MM-DD.",
            )

    newly_absent = absence_scheduler.run_absence_check(date=date)
    check_date = date or _dt.date.today().isoformat()

    return {
        "date":          check_date,
        "newly_absent":  newly_absent,
        "absent_count":  len(newly_absent),
        "message": (
            f"{len(newly_absent)} employee(s) marked Absent for {check_date}."
            if newly_absent
            else f"No new absences for {check_date} — all employees accounted for."
        ),
    }


# ── Correction models ──────────────────────────────────────────────────────────

class CorrectionApplyRequest(BaseModel):
    """
    Body for POST /admin/corrections/apply.

    token          — one-time verification token issued by the verify endpoint.
    employee_id    — must match the employee the token was issued for.
    date           — "YYYY-MM-DD" of the attendance record to correct.
    check_in_time  — new check-in as "HH:MM" (24-hour), or null to leave as-is.
    check_out_time — new check-out as "HH:MM" (24-hour), or null to leave as-is.
    admin_user     — name or ID of the admin making the correction (audit log).
    """
    token:          str
    employee_id:    str
    date:           str
    check_in_time:  Optional[str] = None   # "HH:MM"
    check_out_time: Optional[str] = None   # "HH:MM"
    admin_user:     str = "admin"


# ── Correction endpoints ────────────────────────────────────────────────────────

@app.post("/admin/corrections/verify/{employee_id}")
async def correction_verify(employee_id: str) -> dict:
    """
    Run camera re-verification for the specified employee.

    This endpoint powers the "Verify Employee" button in the admin attendance
    edit screen.  It runs the FULL multi-frame face-recognition pipeline (the
    same pipeline used by POST /mark_attendance) and then applies an identity
    gate to ensure the person in front of the camera is the employee being edited.

    Dashboard integration
    ---------------------
    1. Admin selects an attendance record and clicks "Verify Employee".
    2. Dashboard calls POST /admin/corrections/verify/{employee_id}.
    3. On success: dashboard receives a token and enables the time editing form.
    4. On failure: dashboard displays "Employee verification failed" and keeps
       the form disabled.

    The token expires in TOKEN_TTL_S seconds (default 5 min).  If the admin
    takes too long to fill in the form, the token expires and they must
    re-verify the employee.

    Returns (success):
        { "verified": true, "token": "...", "expires_at": 1234567890.0,
          "similarity": 0.97, "image_path": "correction_verifications/..." }

    Returns (failure):
        { "verified": false, "message": "Employee verification failed: ..." }
    """
    if correction_verifier is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Correction verifier not initialised.",
        )
    if camera is None or not camera.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Camera stream is not available.",
        )

    result = correction_verifier.verify_for_edit(employee_id)

    if result.success:
        return {
            "verified":   True,
            "token":      result.token,
            "expires_at": result.expires_at,
            "similarity": round(result.avg_similarity, 4),
            "image_path": result.image_path,
            "message":    result.message,
        }
    else:
        return {
            "verified":    False,
            "message":     result.message,
            "detected_id": result.detected_id,
            "similarity":  round(result.avg_similarity, 4),
        }


@app.post("/admin/corrections/apply")
async def correction_apply(req: CorrectionApplyRequest) -> dict:
    """
    Apply a verified attendance correction.

    This endpoint is called after the admin has:
      1. Clicked "Verify Employee" and received a valid token.
      2. Filled in the new check-in / check-out times.
      3. Clicked "Apply Correction".

    Workflow (inside this endpoint)
    --------------------------------
    1. Validate and consume the token (single-use, 5-min expiry).
    2. Convert the "HH:MM" time strings into unix timestamps for the given date.
    3. Snapshot the original record timestamps (for the audit log).
    4. Call AttendanceStore.update_record() to apply the edit.
    5. Call CorrectionStore.add_correction() to persist the immutable audit row.
    6. Return the updated record.

    How the audit row is linked to the verification
    -----------------------------------------------
    The token encodes:
      • employee_id (must match req.employee_id — validated by consume_token)
      • verification_timestamp (when the camera check was completed)
      • image_path (path to the saved JPEG)
      • avg_similarity (confidence of the face recognition)

    All four values are written into the CorrectionStore row so every audit
    entry has a direct reference to its photo proof.

    Returns HTTP 400 if the token is invalid, expired, or has already been used.
    Returns HTTP 404 if no attendance record exists for (employee_id, date).
    Returns HTTP 422 if a time string is malformed.
    """
    import datetime as _dt

    if store is None or correction_store is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Store not initialised.",
        )

    # ── Step 1: Validate and consume token ─────────────────────────────────
    pv = consume_token(req.token, req.employee_id)
    if pv is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Verification token is invalid, expired, or has already been used. "
                "Please re-verify the employee."
            ),
        )

    # ── Step 2: Parse time strings into unix timestamps ─────────────────────
    def parse_hhmm(hhmm: str, date_str: str) -> float:
        """Convert "HH:MM" on `date_str` ("YYYY-MM-DD") to a unix timestamp."""
        try:
            d  = _dt.date.fromisoformat(date_str)
            t  = _dt.time.fromisoformat(hhmm)
            return _dt.datetime.combine(d, t).timestamp()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid time format '{hhmm}': {exc}. Expected HH:MM.",
            )

    new_check_in  = parse_hhmm(req.check_in_time,  req.date) if req.check_in_time  else None
    new_check_out = parse_hhmm(req.check_out_time, req.date) if req.check_out_time else None

    if new_check_in is None and new_check_out is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of check_in_time or check_out_time must be provided.",
        )

    # ── Step 3: Snapshot original record for the audit log ─────────────────
    original = store.get_employee_record(req.employee_id, req.date)
    if original is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"No attendance record found for employee '{req.employee_id}' "
                f"on {req.date}."
            ),
        )
    orig_ci  = original.check_in_time
    orig_co  = original.check_out_time

    # ── Step 4: Apply the edit ──────────────────────────────────────────────
    # update_record() re-evaluates shift-aware status fields after every change
    # (check_in_status / late_minutes / check_out_status).
    audit_note = (
        f"Corrected by {req.admin_user} at "
        f"{_dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} "
        f"(verified sim={pv.avg_similarity:.2%})"
    )
    updated = store.update_record(
        employee_id=req.employee_id,
        date=req.date,
        check_in_time=new_check_in,
        check_out_time=new_check_out,
        note=audit_note,
    )
    if updated is None:
        # Should not happen because we already fetched the record above, but
        # guard against a race condition (record deleted between fetch and update).
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Record disappeared during update — please retry.",
        )

    # ── Step 5: Persist the audit row ──────────────────────────────────────
    # This is the "how correction events are logged" step.  The row captures:
    #   • original vs. updated timestamps (full before/after diff)
    #   • admin_user who authorised the change
    #   • verification_timestamp + image_path from the camera check
    correction_store.add_correction(
        employee_id=req.employee_id,
        record_date=req.date,
        original_check_in=orig_ci,
        original_check_out=orig_co,
        updated_check_in=new_check_in if new_check_in is not None else orig_ci,
        updated_check_out=new_check_out if new_check_out is not None else orig_co,
        admin_user=req.admin_user,
        verification_timestamp=pv.verification_ts,
        verification_image_path=pv.image_path,
    )

    logger.info(
        "Correction applied: employee=%s  date=%s  admin=%s",
        req.employee_id,
        req.date,
        req.admin_user,
    )

    return {
        "success":        True,
        "employee_id":    updated.employee_id,
        "date":           updated.date,
        "check_in_time":  updated.check_in_time,
        "check_out_time": updated.check_out_time,
        "status":         updated.status,
        "check_in_status": updated.check_in_status,
        "check_out_status": updated.check_out_status,
        "late_minutes":   updated.late_minutes,
        "note":           updated.note,
        "message":        "Attendance record corrected successfully.",
    }


@app.get("/admin/corrections")
async def list_corrections(employee_id: Optional[str] = None) -> dict:
    """
    Return the attendance correction audit log.

    Each row describes one admin-initiated edit and includes:
      • employee_id / record_date — which record was changed.
      • original vs. updated check-in and check-out timestamps.
      • admin_user — who made the change.
      • verification_timestamp — when the camera re-verification was done.
      • verification_image_path — path to the saved JPEG photo proof.
      • corrected_at — when the edit was applied to the attendance store.

    Args (query parameter):
        employee_id: filter to corrections for a specific employee only.
                     Omit to return all corrections.

    Dashboard integration
    ---------------------
    The audit log table in the admin dashboard calls this endpoint on page load
    and after every successful correction to keep the view in sync.
    """
    if correction_store is None:
        return {"count": 0, "corrections": []}

    records = (
        correction_store.get_by_employee(employee_id)
        if employee_id
        else correction_store.get_all()
    )

    import datetime as _dt

    def _ts(t: Optional[float]) -> Optional[str]:
        if t is None:
            return None
        return _dt.datetime.fromtimestamp(t).strftime("%Y-%m-%d %H:%M:%S")

    return {
        "count": len(records),
        "corrections": [
            {
                "id":                      r.id,
                "employee_id":             r.employee_id,
                "record_date":             r.record_date,
                "original_check_in":       _ts(r.original_check_in),
                "original_check_out":      _ts(r.original_check_out),
                "updated_check_in":        _ts(r.updated_check_in),
                "updated_check_out":       _ts(r.updated_check_out),
                "admin_user":              r.admin_user,
                "verification_timestamp":  _ts(r.verification_timestamp),
                "verification_image_path": r.verification_image_path,
                "corrected_at":            _ts(r.corrected_at),
            }
            for r in records
        ],
    }


@app.get("/admin/calendar")
async def get_calendar_holidays(
    start: Optional[str] = None,
    end:   Optional[str] = None,
) -> dict:
    """
    Return holiday dates in a date range for the dashboard calendar view.

    Dashboard calendar integration
    --------------------------------
    The admin dashboard calendar calls this endpoint on page load and every
    time the user navigates to a different month.  The response contains:

      • holiday_dates     — flat list of "YYYY-MM-DD" strings to highlight.
      • holidays_by_date  — dict mapping "YYYY-MM-DD" → holiday_name, used
                            to populate tooltip text on hovered calendar cells.

    The calendar JavaScript uses the `holiday_dates` set to apply a CSS class
    (`.holiday`) to matching day cells, rendering them in amber so admins can
    instantly see which days are public holidays without leaving the dashboard.

    Args (query parameters):
        start : First date of the range, inclusive ("YYYY-MM-DD").
                Defaults to the first day of the current month.
        end   : Last date of the range, inclusive ("YYYY-MM-DD").
                Defaults to the last day of the current month.

    Example:
        GET /admin/calendar?start=2026-12-01&end=2026-12-31
    """
    import datetime as _dt

    # Default to the current calendar month when no range is supplied.
    today = _dt.date.today()
    if start is None:
        start = today.replace(day=1).isoformat()
    if end is None:
        # Last day of the month: first day of next month minus one day.
        first_next = (today.replace(day=1) + _dt.timedelta(days=32)).replace(day=1)
        end = (first_next - _dt.timedelta(days=1)).isoformat()

    # Validate provided dates.
    try:
        _dt.date.fromisoformat(start)
        _dt.date.fromisoformat(end)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format: {exc}",
        )

    if holiday_store is None:
        return {"start": start, "end": end, "holiday_dates": [], "holidays_by_date": {}}

    holiday_dates = holiday_store.get_dates_in_range(start, end)

    # Build a date → name mapping for tooltip display in the calendar.
    holidays_by_date = {}
    for d in holiday_dates:
        h = holiday_store.get_by_date(d)
        if h:
            holidays_by_date[d] = h.holiday_name

    return {
        "start":            start,
        "end":              end,
        "holiday_dates":    holiday_dates,
        "holidays_by_date": holidays_by_date,
    }


@app.get("/recognition/last", response_model=RecognitionDebugResponse)
async def recognition_last() -> RecognitionDebugResponse:
    """
    Returns the full per-frame breakdown of the most recent verification attempt.

    Use this endpoint to tune the system:
      • Inspect `frame_details` to see which frames passed/failed and why.
      • If a known employee's frames all show similarity just below
        `similarity_threshold`, lower the threshold slightly.
      • If `vote_count` is always 2 of 5, increase `frame_interval_s` so
        frames are more temporally spread and less correlated.
      • If an unknown person occasionally reaches the vote threshold, raise
        `required_votes` or `similarity_threshold`.
    """
    with _last_result_lock:
        vr = _last_result

    if vr is None:
        return RecognitionDebugResponse(has_result=False)

    return RecognitionDebugResponse(
        has_result=True,
        confirmed=vr.confirmed,
        employee_id=vr.employee_id,
        avg_similarity=vr.avg_similarity,
        vote_count=vr.vote_count,
        total_sampled=vr.total_sampled,
        required_votes=vr.required_votes,
        attempt_number=vr.attempt_number,
        tailgating_detected=vr.tailgating_detected,
        tailgating_frames=vr.tailgating_frames,
        stability_frames_achieved=vr.stability_frames_achieved,
        stability_timed_out=vr.stability_timed_out,
        message=vr.message,
        frame_details=_frame_details_out(vr),
    )
