"""
attendance_store.py
-------------------
Attendance persistence with check-in / check-out state machine, shift-based
late and early-leave detection, and per-record status tracking.

Check-in / Check-out state machine
------------------------------------
Each (employee_id, calendar_date) pair has exactly one AttendanceRecord,
which progresses through three states:

  EMPTY → (first recognition) → CHECK_IN_ONLY → (second recognition) → COMPLETE

  EMPTY        — no record exists for this employee today.
  CHECK_IN_ONLY — check_in_time is set; check_out_time is still None.
  COMPLETE     — both check_in_time and check_out_time are set.

Any further recognition calls after COMPLETE are silently rejected so that
hallway re-entries (e.g. stepping out briefly for lunch) do not overwrite the
original check-out.  Operators who need to handle mid-day re-entries should
extend the state machine to support multiple check-in/check-out pairs.

Late detection
--------------
When a check-in is recorded the store compares check_in_time against the
employee's shift_start_time + grace_period_minutes:

    deadline = shift_start + grace_period
    if check_in_time > deadline:
        status = "Late"
        late_minutes = ceil((check_in_time - deadline) / 60)

Early-leave / Overtime detection
---------------------------------
When a check-out is recorded the store compares check_out_time against the
employee's shift_end_time:

    if check_out_time < shift_end:
        checkout_status = "Early Leave"
    elif check_out_time >= shift_end + overtime_threshold:
        checkout_status = "Overtime"
    else:
        checkout_status = "On Time"

The overall record status (record.status) reflects the most severe condition:
    Late > Early Leave > Overtime > On Time

Shift configuration
--------------------
Each employee can have an individual ShiftConfig registered via
AttendanceStore.add_shift().  Employees without a registered shift fall back
to the store's default_shift.  Shifts are stored as naive datetime.time
objects (local wall-clock time) so no timezone library is required.

    add_shift("EMP001", ShiftConfig(
        shift_start=datetime.time(8, 30),
        shift_end=datetime.time(17, 30),
        grace_period_minutes=15,
    ))

Thread safety
-------------
All mutable state (_day_records, _shifts) is protected by a single
threading.Lock.  The lock is held only for the minimum time needed to read
or mutate state — no I/O or heavy computation occurs inside the lock.
"""

import math
import time
import datetime
import threading
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Attendance status constants ────────────────────────────────────────────────
# Stored as plain strings so they serialise directly to JSON without extra
# conversion.  Keep these in sync with the dashboard filter values.

class AttendanceStatus:
    ON_TIME     = "On Time"
    LATE        = "Late"
    EARLY_LEAVE = "Early Leave"
    OVERTIME    = "Overtime"
    ABSENT      = "Absent"      # set by AbsenceScheduler, never by face recognition


# ── Entry type constants ───────────────────────────────────────────────────────

class EntryType:
    CHECK_IN  = "Check-In"
    CHECK_OUT = "Check-Out"


# ── Shift configuration ────────────────────────────────────────────────────────

@dataclass
class ShiftConfig:
    """
    Defines the expected working hours for one shift.

    All time objects are naive (no timezone).  The store compares them against
    the local wall-clock time derived from unix timestamps via
    datetime.datetime.fromtimestamp(), which also uses local time, so the two
    are always consistent as long as the server clock is correct.

    Tuning
    ------
    • grace_period_minutes   — extend this for roles with flexible start times
                               (e.g. remote workers) or strict environments (0).
    • overtime_threshold_minutes — the number of minutes past shift_end that
                               must elapse before the status upgrades from
                               "On Time" to "Overtime".  Default 30 min avoids
                               marking employees who stay a few minutes late.
    """
    shift_start: datetime.time = datetime.time(9, 0)    # 09:00 default
    shift_end:   datetime.time = datetime.time(18, 0)   # 18:00 default
    grace_period_minutes: int  = 10    # allowed lateness before "Late" is set
    overtime_threshold_minutes: int = 30  # extra minutes past shift_end → "Overtime"


# ── Attendance record ──────────────────────────────────────────────────────────

@dataclass
class AttendanceRecord:
    """
    One calendar-day attendance record for a single employee.

    The record is created on first recognition (check-in) and updated in-place
    on second recognition (check-out).  It is never deleted or replaced so
    the full day history is always available.

    Fields
    ------
    employee_id      — unique employee identifier.
    date             — "YYYY-MM-DD" string for the calendar day (local time).
    check_in_time    — unix timestamp of the check-in event, or None.
    check_out_time   — unix timestamp of the check-out event, or None.
    confidence       — face-recognition similarity score of the most recent event.
    check_in_status  — "On Time" or "Late" (set at check-in time).
    check_out_status — None (before check-out), then "On Time", "Early Leave",
                       or "Overtime" (set at check-out time).
    late_minutes     — positive integer when check_in_status == "Late".
    note             — free-text field for operator comments.
    """
    employee_id:      str
    date:             str                  # "YYYY-MM-DD"
    check_in_time:    Optional[float] = None
    check_out_time:   Optional[float] = None
    confidence:       float = 0.0
    check_in_status:  str = AttendanceStatus.ON_TIME
    check_out_status: Optional[str] = None
    late_minutes:     int = 0
    note:             str = ""
    # is_absent is set to True by AbsenceScheduler.  It is NEVER set by the
    # normal face-recognition flow.  When True, check_in_time and
    # check_out_time are both None and the record is read-only: a subsequent
    # check-in from the recognition pipeline will NOT overwrite an absent
    # record — the record() method rejects writes once is_absent is set.
    is_absent: bool = False

    @property
    def status(self) -> str:
        """
        Overall attendance status for the day.

        Priority order (highest to lowest severity):
            Absent > Late > Early Leave > Overtime > On Time

        "Absent" short-circuits all other conditions because an employee who
        never checked in has no check-in or check-out status to evaluate.
        """
        if self.is_absent:
            return AttendanceStatus.ABSENT
        if self.check_in_status == AttendanceStatus.LATE:
            return AttendanceStatus.LATE
        if self.check_out_status == AttendanceStatus.EARLY_LEAVE:
            return AttendanceStatus.EARLY_LEAVE
        if self.check_out_status == AttendanceStatus.OVERTIME:
            return AttendanceStatus.OVERTIME
        return AttendanceStatus.ON_TIME

    @property
    def is_complete(self) -> bool:
        """True when both check-in and check-out have been recorded."""
        return self.check_in_time is not None and self.check_out_time is not None


# ── Record result ──────────────────────────────────────────────────────────────

@dataclass
class RecordResult:
    """
    Return value from AttendanceStore.record().

    Tells the caller what kind of event was just recorded (Check-In or
    Check-Out) and provides the full updated record so the API can build a
    rich response without a second lookup.
    """
    record:     AttendanceRecord
    entry_type: str    # EntryType.CHECK_IN or EntryType.CHECK_OUT


# ── Main store ─────────────────────────────────────────────────────────────────

class AttendanceStore:
    """
    Thread-safe check-in / check-out attendance recorder with shift awareness.

    State machine per (employee_id, date)
    --------------------------------------
    No record   → record() creates one, sets check_in_time  → returns CHECK_IN
    Check-in only → record() updates it, sets check_out_time → returns CHECK_OUT
    Complete (both set) → record() returns None (silently ignored)

    Shift lookup
    ------------
    record() resolves the employee's shift via:
      1. Per-employee shift registered with add_shift()    (highest priority)
      2. The store's default_shift                         (fallback)
    """

    def __init__(
        self,
        default_shift: Optional[ShiftConfig] = None,
    ) -> None:
        """
        Args:
            default_shift: Shift applied to employees with no individual shift.
                           Defaults to 09:00–18:00 with 10-min grace period.
        """
        self._default_shift: ShiftConfig = default_shift or ShiftConfig()

        # (employee_id, "YYYY-MM-DD") → AttendanceRecord
        # All access must be under self._lock.
        self._day_records: Dict[Tuple[str, str], AttendanceRecord] = {}

        # employee_id → ShiftConfig  (only employees with custom shifts)
        self._shifts: Dict[str, ShiftConfig] = {}

        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Shift management
    # ------------------------------------------------------------------

    def add_shift(self, employee_id: str, shift: ShiftConfig) -> None:
        """Register or replace the shift configuration for employee_id."""
        with self._lock:
            self._shifts[employee_id] = shift
        logger.info(
            "Shift registered: employee=%s  start=%s  end=%s  grace=%d min",
            employee_id,
            shift.shift_start,
            shift.shift_end,
            shift.grace_period_minutes,
        )

    def get_shift(self, employee_id: str) -> ShiftConfig:
        """Return the shift for employee_id, or the default shift."""
        with self._lock:
            return self._shifts.get(employee_id, self._default_shift)

    # ------------------------------------------------------------------
    # Core recording logic
    # ------------------------------------------------------------------

    def record(
        self,
        employee_id: str,
        confidence: float,
        note: str = "",
    ) -> Optional[RecordResult]:
        """
        Record a check-in or check-out event for employee_id.

        Decision logic
        --------------
        The key that uniquely identifies a day's attendance is:
            (employee_id, today's date as "YYYY-MM-DD")

        • No existing record for today  →  create record, set check_in_time,
                                           evaluate check-in status vs shift.
        • Record exists, check_out_time is None  →  update record, set
                                           check_out_time, evaluate check-out
                                           status vs shift.
        • Record exists and is_complete  →  return None (both events already
                                           recorded; no duplicate writes).

        Returns
        -------
        RecordResult  — on successful check-in or check-out.
        None          — when the record is already complete for today.
        """
        today = datetime.date.today().isoformat()
        key = (employee_id, today)
        now = time.time()

        with self._lock:
            # Resolve shift config inside lock to avoid TOCTOU on _shifts dict.
            shift = self._shifts.get(employee_id, self._default_shift)

            existing = self._day_records.get(key)

            # ── Case 0: Absent record exists → block check-in ─────────────
            # If the absence scheduler already marked this employee absent,
            # a subsequent face recognition (e.g. a very late arrival after
            # the absence window) must not silently overwrite the absent record.
            # Return None so the API can inform the operator.  In production,
            # expose an "undo absent" admin endpoint if late arrivals are common.
            if existing is not None and existing.is_absent:
                logger.warning(
                    "Skipping check-in for %s on %s — already marked Absent. "
                    "Use the admin API to undo the absence if the employee arrived.",
                    employee_id,
                    today,
                )
                return None

            # ── Case 1: No record today → CHECK-IN ────────────────────────
            if existing is None:
                check_in_status, late_minutes = self._evaluate_check_in(now, shift)
                rec = AttendanceRecord(
                    employee_id=employee_id,
                    date=today,
                    check_in_time=now,
                    confidence=confidence,
                    check_in_status=check_in_status,
                    late_minutes=late_minutes,
                    note=note,
                )
                self._day_records[key] = rec
                logger.info(
                    "CHECK-IN: employee=%s  time=%s  status=%s  late_min=%d",
                    employee_id,
                    _fmt_time(now),
                    check_in_status,
                    late_minutes,
                )
                return RecordResult(record=rec, entry_type=EntryType.CHECK_IN)

            # ── Case 2: Check-in recorded, no check-out yet → CHECK-OUT ───
            if existing.check_out_time is None:
                check_out_status = self._evaluate_check_out(now, shift)
                existing.check_out_time = now
                existing.confidence = confidence
                existing.check_out_status = check_out_status
                if note:
                    existing.note = note
                logger.info(
                    "CHECK-OUT: employee=%s  time=%s  checkout_status=%s  overall=%s",
                    employee_id,
                    _fmt_time(now),
                    check_out_status,
                    existing.status,
                )
                return RecordResult(record=existing, entry_type=EntryType.CHECK_OUT)

            # ── Case 3: Both events already recorded → reject ──────────────
            # This prevents a brief re-entry (e.g. forgotten item) from
            # overwriting the check-out, which would corrupt the day's record.
            logger.debug(
                "Skipping %s — both check-in and check-out already recorded for %s.",
                employee_id,
                today,
            )
            return None

    # ------------------------------------------------------------------
    # Status evaluation helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _evaluate_check_in(
        timestamp: float,
        shift: ShiftConfig,
    ) -> Tuple[str, int]:
        """
        Compare check-in time against shift_start + grace_period.

        Returns
        -------
        (status, late_minutes)
            status       — AttendanceStatus.ON_TIME or AttendanceStatus.LATE
            late_minutes — minutes past the grace deadline (0 when On Time)

        How it works
        ------------
        1. Convert unix timestamp → local datetime.time.
        2. Build a deadline = shift_start + grace_period_minutes on today's date.
        3. If check_in_time > deadline: Late, and late_minutes = ceil of delta.
        """
        check_in_dt = datetime.datetime.fromtimestamp(timestamp)
        today = check_in_dt.date()

        # Deadline is the latest acceptable check-in moment.
        deadline_dt = datetime.datetime.combine(today, shift.shift_start) + \
                      datetime.timedelta(minutes=shift.grace_period_minutes)

        if check_in_dt > deadline_dt:
            delta_seconds = (check_in_dt - deadline_dt).total_seconds()
            late_minutes = math.ceil(delta_seconds / 60)
            return AttendanceStatus.LATE, late_minutes

        return AttendanceStatus.ON_TIME, 0

    @staticmethod
    def _evaluate_check_out(
        timestamp: float,
        shift: ShiftConfig,
    ) -> str:
        """
        Compare check-out time against shift_end and overtime threshold.

        Returns
        -------
        AttendanceStatus string — one of:
            "Early Leave"  check_out_time < shift_end
            "Overtime"     check_out_time >= shift_end + overtime_threshold
            "On Time"      otherwise (checked out within the normal window)

        How it works
        ------------
        1. Convert unix timestamp → local datetime.time.
        2. Compare against shift_end and shift_end + overtime_threshold.
        """
        check_out_dt = datetime.datetime.fromtimestamp(timestamp)
        today = check_out_dt.date()

        shift_end_dt = datetime.datetime.combine(today, shift.shift_end)
        overtime_dt  = shift_end_dt + datetime.timedelta(
            minutes=shift.overtime_threshold_minutes
        )

        if check_out_dt < shift_end_dt:
            return AttendanceStatus.EARLY_LEAVE
        if check_out_dt >= overtime_dt:
            return AttendanceStatus.OVERTIME
        return AttendanceStatus.ON_TIME

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def get_all(self) -> List[AttendanceRecord]:
        """Return all records across all employees and dates."""
        with self._lock:
            return list(self._day_records.values())

    def get_today(self) -> List[AttendanceRecord]:
        """Return all records for today's date only."""
        today = datetime.date.today().isoformat()
        with self._lock:
            return [
                rec for (_, date), rec in self._day_records.items()
                if date == today
            ]

    def get_employee_today(self, employee_id: str) -> Optional[AttendanceRecord]:
        """Return today's record for a specific employee, or None."""
        today = datetime.date.today().isoformat()
        with self._lock:
            return self._day_records.get((employee_id, today))

    def get_employee_record(
        self, employee_id: str, date: Optional[str] = None
    ) -> Optional[AttendanceRecord]:
        """
        Return the record for a specific employee on a specific date.

        Args:
            date: "YYYY-MM-DD".  Defaults to today in local time.

        Used by AbsenceScheduler to check whether an employee has a check-in
        before deciding to mark them absent.  Returning None means no record
        exists at all (neither present nor already marked absent).
        """
        if date is None:
            date = datetime.date.today().isoformat()
        with self._lock:
            return self._day_records.get((employee_id, date))

    def mark_absent(
        self,
        employee_id: str,
        date: Optional[str] = None,
        note: str = "Auto-generated by absence scheduler.",
    ) -> Optional[AttendanceRecord]:
        """
        Insert an Absent record for employee_id on date — idempotent.

        How duplicate prevention works
        -------------------------------
        This method acquires self._lock before reading or writing.  Inside
        the lock it performs a three-way check:

          1. Existing record has a check_in_time
             → Employee attended (on time or late); do NOT overwrite.
             → Return None.

          2. Existing record has is_absent=True
             → Already marked absent by a previous call (scheduler re-run,
               manual trigger, etc.); nothing to do.
             → Return None.

          3. No record exists for (employee_id, date)
             → Safe to insert a new Absent record.
             → Create, store, and return it.

        Because steps 1–3 are evaluated atomically under the lock, two
        concurrent callers (e.g. scheduler thread + manual API request)
        can never both reach step 3 and create duplicate records.

        Args:
            employee_id : employee to mark absent.
            date        : "YYYY-MM-DD" in local time.  Defaults to today.
            note        : free-text annotation stored on the record.

        Returns:
            The newly created AttendanceRecord, or None if the write was
            skipped (employee present or already marked absent).
        """
        if date is None:
            date = datetime.date.today().isoformat()

        key = (employee_id, date)

        with self._lock:
            existing = self._day_records.get(key)

            # ── Guard 1: employee has a check-in ──────────────────────────
            if existing is not None and existing.check_in_time is not None:
                logger.debug(
                    "mark_absent: %s already has a check-in on %s — skipping.",
                    employee_id,
                    date,
                )
                return None

            # ── Guard 2: already absent ───────────────────────────────────
            if existing is not None and existing.is_absent:
                logger.debug(
                    "mark_absent: %s already marked Absent on %s — skipping.",
                    employee_id,
                    date,
                )
                return None

            # ── Write absent record ───────────────────────────────────────
            # check_in_time and check_out_time remain None to signal that the
            # employee did not physically interact with the system at all.
            rec = AttendanceRecord(
                employee_id=employee_id,
                date=date,
                check_in_time=None,
                check_out_time=None,
                confidence=0.0,
                check_in_status=AttendanceStatus.ABSENT,
                is_absent=True,
                note=note,
            )
            self._day_records[key] = rec
            logger.info(
                "ABSENT recorded: employee=%s  date=%s  note=%r",
                employee_id,
                date,
                note,
            )
            return rec

    def update_record(
        self,
        employee_id: str,
        date: str,
        check_in_time:  Optional[float] = None,
        check_out_time: Optional[float] = None,
        note: str = "",
    ) -> Optional["AttendanceRecord"]:
        """
        Overwrite the timestamps of an existing attendance record.

        This method is called exclusively by the attendance correction
        workflow (POST /admin/corrections/apply) **after** the employee has
        been re-verified by the camera pipeline.  It must never be called
        from the normal face-recognition flow.

        How timestamps and statuses are updated
        ----------------------------------------
        Updating a timestamp is not just a field assignment — the derived
        status fields (check_in_status, late_minutes, check_out_status) depend
        on the raw times and must be re-evaluated after every change:

          • If check_in_time is provided:
              Re-run _evaluate_check_in() against the employee's shift to
              recompute check_in_status ("On Time" / "Late") and late_minutes.

          • If check_out_time is provided:
              Re-run _evaluate_check_out() against the employee's shift to
              recompute check_out_status ("On Time" / "Early Leave" / "Overtime").

          • is_absent is cleared to False when a check_in_time is provided,
              because recording a real check-in time means the employee was
              present (the absent flag was either a mistake or the employee
              arrived after the absence deadline and the record is being corrected).

        If a field is not provided (None), the corresponding existing value and
        its derived status are left unchanged.  This allows an admin to fix only
        the check-in without touching the check-out and vice versa.

        Args:
            employee_id    — employee whose record to update.
            date           — "YYYY-MM-DD" of the attendance day.
            check_in_time  — new check-in unix timestamp, or None to keep existing.
            check_out_time — new check-out unix timestamp, or None to keep existing.
            note           — optional note appended to the record (not cleared
                             when empty — pass a new note to overwrite the old one).

        Returns:
            The updated AttendanceRecord, or None if no record exists for
            (employee_id, date).

        Thread safety
        -------------
        All reads and writes happen under self._lock so a concurrent
        mark_attendance call cannot race with this update.
        """
        key = (employee_id, date)

        with self._lock:
            rec = self._day_records.get(key)
            if rec is None:
                logger.warning(
                    "update_record: no record found for employee=%s date=%s.",
                    employee_id,
                    date,
                )
                return None

            shift = self._shifts.get(employee_id, self._default_shift)

            # ── Update check-in ─────────────────────────────────────────────
            if check_in_time is not None:
                ci_status, late_min = self._evaluate_check_in(check_in_time, shift)
                rec.check_in_time    = check_in_time
                rec.check_in_status  = ci_status
                rec.late_minutes     = late_min
                # If an absence was recorded in error and the admin is now
                # setting a real check-in, clear the absent flag.
                if rec.is_absent:
                    rec.is_absent = False
                    logger.info(
                        "update_record: cleared is_absent for %s on %s "
                        "(corrected check-in time provided).",
                        employee_id,
                        date,
                    )

            # ── Update check-out ────────────────────────────────────────────
            if check_out_time is not None:
                co_status          = self._evaluate_check_out(check_out_time, shift)
                rec.check_out_time  = check_out_time
                rec.check_out_status = co_status

            # ── Update note ─────────────────────────────────────────────────
            if note:
                rec.note = note

            logger.info(
                "RECORD UPDATED: employee=%s  date=%s  "
                "check_in=%s(%s)  check_out=%s(%s)  status=%s",
                employee_id,
                date,
                _fmt_time(rec.check_in_time)  if rec.check_in_time  else "—",
                rec.check_in_status,
                _fmt_time(rec.check_out_time) if rec.check_out_time else "—",
                rec.check_out_status or "—",
                rec.status,
            )
            return rec

    def get_known_employee_ids(self) -> list:
        """
        Return all employee IDs that have either a shift or an attendance record.

        Used as a fallback when the EmbeddingCache is not available.  In
        normal operation, pass the EmbeddingCache.list_ids() callable to the
        scheduler instead — it is the authoritative source of enrolled employees.
        """
        with self._lock:
            from_shifts = set(self._shifts.keys())
            from_records = {eid for (eid, _) in self._day_records.keys()}
            return sorted(from_shifts | from_records)


# ── Formatting helper ──────────────────────────────────────────────────────────

def _fmt_time(timestamp: float) -> str:
    """Format a unix timestamp as a human-readable local time string."""
    return datetime.datetime.fromtimestamp(timestamp).strftime("%H:%M:%S")
