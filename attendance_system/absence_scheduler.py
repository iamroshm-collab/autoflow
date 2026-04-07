"""
absence_scheduler.py
--------------------
Background daemon that automatically marks employees as "Absent" once their
shift's absence window has passed without a check-in.

No external scheduler library is required — the implementation uses only
Python's standard-library threading and datetime primitives.

────────────────────────────────────────────────────────────────────────────
How the daily schedule works
────────────────────────────────────────────────────────────────────────────
AbsenceScheduler spawns one daemon thread for the lifetime of the application.
The thread runs a tight loop:

  1. Compute the next trigger datetime.
       target = today at `absence_check_time` (e.g. 12:00)
       If the current wall-clock time has already passed that point, schedule
       for tomorrow instead — this handles the case where the server starts
       after the configured check time.

  2. Sleep until the target using `_stop_event.wait(timeout=seconds_until_target)`.
       This is the key difference from a naive `time.sleep(86400)`:
         • It wakes up precisely at the target wall-clock time instead of
           drifting by the job's own execution time.
         • It exits immediately when stop() is called, giving sub-second
           clean shutdown instead of blocking until the next trigger.
         • DST transitions are handled correctly because the target is
           recomputed on each iteration as an absolute datetime.

  3. Run run_absence_check(date=today) once.

  4. Repeat forever (daemon thread exits automatically with the process).

────────────────────────────────────────────────────────────────────────────
How employees without check-ins are detected
────────────────────────────────────────────────────────────────────────────
run_absence_check(date) iterates over every employee returned by
get_employee_ids() and applies two tests:

  Test A — Has the employee's absence window opened?
    absence_deadline = shift_start + hours_after_shift_start
    if now < absence_deadline: skip (shift hasn't started long enough ago).

    This per-employee deadline means:
      • A 09:00 shift employee is checked after 12:00 (3-hour window).
      • A 12:00 shift employee is checked after 15:00 — even if the global
        scheduler fires at 12:30, they won't be marked absent yet.

  Test B — Does the employee have a check-in record for `date`?
    store.get_employee_record(employee_id, date) returns None or a record.
    If the record exists and has a check_in_time set → employee came in → skip.

  Both tests pass → mark_absent() is called.

────────────────────────────────────────────────────────────────────────────
How absence records are inserted safely without duplicates
────────────────────────────────────────────────────────────────────────────
AttendanceStore.mark_absent() is the single write point.  Inside the store's
lock it performs:

  1. Check for existing record at (employee_id, date).
  2. If record exists and has check_in_time  → employee attended → skip.
  3. If record exists and is_absent=True     → already marked absent → skip.
  4. Only if no record exists               → create Absent record and store it.

This makes the function idempotent: calling it twice, or calling it while a
manual API trigger is also running, produces exactly one absent record.
The lock guarantees atomicity — no two callers can both pass test 4 and both
write a record.
"""

import datetime
import logging
import threading
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from .attendance_store import AttendanceStore

# TYPE_CHECKING import avoids a circular-import at runtime while still giving
# type checkers the HolidayStore reference.
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .holiday_store import HolidayStore

logger = logging.getLogger(__name__)

# Dedicated logger for absence audit events.  Route this to a separate file
# in production so operators can review auto-generated records easily.
absence_audit_logger = logging.getLogger(__name__ + ".audit")


# ── Configuration ──────────────────────────────────────────────────────────────

@dataclass
class AbsenceSchedulerConfig:
    """
    Tuning parameters for the absence scheduler.

    absence_check_time
        Local wall-clock time at which the daily job fires.  Choose a time
        well after the latest shift start + hours_after_shift_start to ensure
        all shifts are covered.  Default: 12:00 (noon).

    hours_after_shift_start
        An employee is only eligible to be marked Absent once this many hours
        have elapsed since their shift_start.  Default: 3.0 hours.
        Example: shift 09:00, threshold 3 h → absent window opens at 12:00.
        Increase if you want to allow late arrivals a longer grace period before
        the system gives up and marks them absent.

    run_on_startup
        When True, the scheduler fires one immediate check at startup (using
        today's date and the current time for the absence-window test).  Useful
        for recovering a server that restarted after the daily trigger time.
        Default: True.
    """
    absence_check_time: datetime.time = datetime.time(12, 0)  # 12:00 daily
    hours_after_shift_start: float = 3.0
    run_on_startup: bool = True


# ── Scheduler ──────────────────────────────────────────────────────────────────

class AbsenceScheduler:
    """
    Daemon thread that fires run_absence_check() once per day at a configured
    wall-clock time, then automatically marks unchecked-in employees as Absent.

    Usage
    -----
        scheduler = AbsenceScheduler(
            config=AbsenceSchedulerConfig(),
            store=attendance_store,
            get_employee_ids=lambda: embedding_cache.list_ids(),
        )
        scheduler.start()   # call at application startup
        ...
        scheduler.stop()    # call at application shutdown — returns within ~1 s
    """

    def __init__(
        self,
        config: AbsenceSchedulerConfig,
        store: AttendanceStore,
        get_employee_ids: Callable[[], List[str]],
        holiday_store: Optional["HolidayStore"] = None,
    ) -> None:
        """
        Args:
            config           — scheduler tuning parameters.
            store            — the shared AttendanceStore; mark_absent() is
                               called on it inside the lock, so no extra
                               synchronisation is needed here.
            get_employee_ids — callable that returns the current list of active
                               employee IDs.  Called fresh on every run so that
                               newly enrolled employees are automatically included
                               in future checks without restarting the scheduler.
            holiday_store    — optional HolidayStore instance.  When provided,
                               run_absence_check() will skip the entire daily
                               run if the target date is a recorded holiday.
                               Pass None to disable holiday awareness (original
                               behaviour is preserved).

        How absence generation skips holidays
        --------------------------------------
        When holiday_store is supplied, the very first action inside
        run_absence_check() is to call holiday_store.is_holiday(date).
        If the date is a holiday the method logs an informational message and
        returns an empty list immediately — no employees are iterated over and
        no absent records are created.  This prevents false-absent entries on
        days when the entire organisation is on a public holiday.
        """
        self._cfg = config
        self._store = store
        self._get_ids = get_employee_ids
        self._holiday_store = holiday_store
        # Event used both to signal shutdown AND as an interruptible sleep.
        self._stop_event = threading.Event()
        self._thread = threading.Thread(
            target=self._run_loop,
            name="AbsenceSchedulerThread",
            daemon=True,   # exits automatically when the main process exits
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the background scheduler thread."""
        self._thread.start()
        logger.info(
            "AbsenceScheduler started. daily_trigger=%s  hours_after_start=%.1f",
            self._cfg.absence_check_time.strftime("%H:%M"),
            self._cfg.hours_after_shift_start,
        )
        # Optional immediate check to recover from a missed daily trigger.
        if self._cfg.run_on_startup:
            logger.info("Running startup absence check (run_on_startup=True).")
            self.run_absence_check()

    def stop(self, timeout: float = 5.0) -> None:
        """
        Signal the scheduler thread to exit and wait for it to finish.

        Because the thread sleeps using _stop_event.wait(), setting the event
        causes it to wake up immediately rather than waiting until the next
        daily trigger.  This means stop() returns in under 1 second in all
        normal cases.
        """
        self._stop_event.set()
        self._thread.join(timeout=timeout)
        logger.info("AbsenceScheduler stopped.")

    # ------------------------------------------------------------------
    # Background loop
    # ------------------------------------------------------------------

    def _run_loop(self) -> None:
        """
        Core scheduler loop — runs for the lifetime of the application.

        Lifecycle per iteration
        -----------------------
        1. Compute `sleep_s` = seconds until the next daily trigger.
        2. Sleep using _stop_event.wait(timeout=sleep_s):
             • If stop() is called before the timeout → event fires → loop exits.
             • If the timeout expires naturally → the daily job is due → continue.
        3. If stop was requested, exit.  Otherwise run the absence check.
        4. Repeat.

        Why _stop_event.wait() instead of time.sleep()
        ------------------------------------------------
        time.sleep() cannot be interrupted.  If the next trigger is 8 hours
        away and the server is shut down, the thread would block for up to 8
        hours before exiting — keeping the process alive.  Using wait() with a
        timeout gives us a sleep that is both precise and interruptible.
        """
        while not self._stop_event.is_set():
            sleep_s = self._seconds_until_next_trigger()
            logger.debug(
                "AbsenceScheduler sleeping %.0f s until next trigger (%s).",
                sleep_s,
                (datetime.datetime.now() + datetime.timedelta(seconds=sleep_s)).strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
            )

            # wait() returns True if the event was set (stop requested),
            # False if the timeout expired naturally (trigger time reached).
            stop_requested = self._stop_event.wait(timeout=sleep_s)
            if stop_requested:
                break

            # Daily trigger fired — run the absence check.
            logger.info("AbsenceScheduler daily trigger fired.")
            self.run_absence_check()

        logger.info("AbsenceScheduler loop exiting.")

    def _seconds_until_next_trigger(self) -> float:
        """
        Compute how many seconds until the next daily trigger.

        Algorithm
        ---------
        1. Build `today_trigger` = today's date combined with `absence_check_time`.
        2. If now < today_trigger → trigger is still ahead today → use it.
        3. If now >= today_trigger → trigger already passed today →
             schedule for tomorrow (add 1 day).

        This guarantees the returned value is always positive (> 0), so
        _stop_event.wait(timeout=...) is always called with a sensible value.
        """
        now = datetime.datetime.now()
        today_trigger = datetime.datetime.combine(now.date(), self._cfg.absence_check_time)

        if now < today_trigger:
            target = today_trigger
        else:
            # Today's trigger has passed — aim for the same time tomorrow.
            target = today_trigger + datetime.timedelta(days=1)

        delta = (target - now).total_seconds()
        # Clamp to a small positive value to guard against sub-millisecond
        # floating-point rounding that could make delta slightly negative.
        return max(delta, 0.1)

    # ------------------------------------------------------------------
    # Absence check job
    # ------------------------------------------------------------------

    def run_absence_check(
        self, date: Optional[str] = None
    ) -> List[str]:
        """
        Scan all known employees and mark absent those without a check-in.

        This method is the core of the absence detection logic.  It can be
        called by the scheduler loop OR directly (e.g. from a manual API
        trigger or a test).

        Args:
            date: ISO date string "YYYY-MM-DD" to check.  Defaults to today
                  in local time.  Pass a past date to back-fill absences.

        Returns:
            List of employee IDs that were newly marked Absent in this run.
            An empty list means either everyone was present or all eligible
            employees already had an absent record.

        How employees without check-ins are detected
        ---------------------------------------------
        For each employee_id returned by get_employee_ids():

          1. Resolve their shift via store.get_shift(employee_id).
          2. Compute the absence deadline:
               deadline = shift_start + hours_after_shift_start
             If the current time has not reached `deadline`, skip the employee —
             their absence window hasn't opened yet (they might still arrive).
          3. Call store.get_employee_record(employee_id, date).
             If a record exists with check_in_time set → employee present → skip.
          4. Call store.mark_absent(employee_id, date) which is idempotent:
             it only writes if no record exists, so double-runs are safe.
        """
        if date is None:
            date = datetime.date.today().isoformat()

        # ── Holiday guard ──────────────────────────────────────────────────────
        # If a HolidayStore was provided and today is a public holiday, skip the
        # entire check.  There is no point iterating over employees — nobody is
        # expected to be in, so marking them absent would be incorrect.
        #
        # This is the primary integration point between holiday management and
        # absence generation.  The holiday_store.is_holiday() call is a fast
        # SQLite SELECT by date, so it adds negligible overhead.
        if self._holiday_store is not None and self._holiday_store.is_holiday(date):
            holiday = self._holiday_store.get_by_date(date)
            logger.info(
                "Absence check skipped — %s is a public holiday (%s).",
                date,
                holiday.holiday_name if holiday else "unknown",
            )
            absence_audit_logger.info(
                "ABSENCE CHECK SKIPPED (HOLIDAY): date=%s  holiday=%s",
                date,
                holiday.holiday_name if holiday else "unknown",
            )
            return []   # no employees marked absent on a holiday

        now = datetime.datetime.now()
        employee_ids = self._get_ids()
        newly_absent: List[str] = []

        logger.info(
            "Absence check started: date=%s  employees_to_check=%d",
            date,
            len(employee_ids),
        )

        for eid in employee_ids:
            # ── Step 1: Resolve shift ──────────────────────────────────────
            shift = self._store.get_shift(eid)

            # ── Step 2: Check if absence window has opened ─────────────────
            # The absence window opens `hours_after_shift_start` hours after
            # the employee's shift_start.  Employees on later shifts are
            # protected from premature absent marking.
            #
            # Example: shift_start=12:00, hours_after=3 → deadline=15:00.
            # If it's currently 13:00 and the scheduler just fired, this
            # employee is skipped — they might still arrive by 15:00.
            check_date = datetime.date.fromisoformat(date)
            absence_deadline_dt = (
                datetime.datetime.combine(check_date, shift.shift_start)
                + datetime.timedelta(hours=self._cfg.hours_after_shift_start)
            )

            # Compare against the actual current time (not the scheduled
            # trigger time), so a back-fill run on a past date still works:
            # when checking yesterday, now is always past yesterday's deadline.
            if now < absence_deadline_dt:
                logger.debug(
                    "Skipping %s — absence window not yet open "
                    "(deadline=%s, now=%s).",
                    eid,
                    absence_deadline_dt.strftime("%H:%M"),
                    now.strftime("%H:%M"),
                )
                continue

            # ── Step 3: Check for an existing check-in ────────────────────
            # If the employee already has a check-in (even a late one), they
            # are present and must not be marked absent.
            existing = self._store.get_employee_record(eid, date)
            if existing is not None and existing.check_in_time is not None:
                logger.debug(
                    "Skipping %s — check-in already recorded at %s.",
                    eid,
                    datetime.datetime.fromtimestamp(existing.check_in_time).strftime("%H:%M:%S"),
                )
                continue

            # ── Step 4: Mark absent ────────────────────────────────────────
            # mark_absent() is idempotent: it acquires the store lock and
            # only writes a new record if none exists.  If this function is
            # called twice (e.g. scheduler + manual trigger running in
            # parallel), exactly one call will create the record; the other
            # will see it already exists and return None.
            rec = self._store.mark_absent(eid, date)
            if rec is not None:
                newly_absent.append(eid)
                absence_audit_logger.warning(
                    "ABSENT: employee=%s  date=%s  shift_start=%s  "
                    "absence_deadline=%s",
                    eid,
                    date,
                    shift.shift_start.strftime("%H:%M"),
                    absence_deadline_dt.strftime("%H:%M"),
                )

        logger.info(
            "Absence check complete: date=%s  newly_marked_absent=%d  %s",
            date,
            len(newly_absent),
            newly_absent if newly_absent else "(none)",
        )
        return newly_absent
