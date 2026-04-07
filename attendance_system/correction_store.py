"""
correction_store.py
-------------------
SQLite-backed audit log for attendance corrections made through the
admin dashboard's camera re-verification workflow.

How correction events are logged for audit purposes
----------------------------------------------------
Every time an admin successfully corrects an attendance record, one row is
inserted into the `corrections` table via CorrectionStore.add_correction().
The call site is the POST /admin/corrections/apply endpoint in app.py, which
only reaches add_correction() *after*:

  1. A valid, unexpired verification token is presented (issued by the
     camera re-verification step).
  2. AttendanceStore.update_record() successfully updates the record.

This ordering guarantees every correction row has:
  • A face-verified identity (the employee stood in front of the camera).
  • A saved photo proof path (the frame captured at verification time).
  • The exact original timestamps before the edit was applied.
  • The admin who authorised the change.

The audit log is write-once and never updated — a second correction on the
same record produces a second row, giving a full chain of custody.

Schema
------
  id                    INTEGER PRIMARY KEY AUTOINCREMENT
  employee_id           TEXT    NOT NULL
  record_date           TEXT    NOT NULL   -- "YYYY-MM-DD"
  original_check_in     REAL               -- unix timestamp or NULL
  original_check_out    REAL               -- unix timestamp or NULL
  updated_check_in      REAL               -- unix timestamp or NULL
  updated_check_out     REAL               -- unix timestamp or NULL
  admin_user            TEXT    NOT NULL
  verification_timestamp REAL   NOT NULL   -- unix timestamp of camera check
  verification_image_path TEXT  NOT NULL   -- relative path to saved JPEG
  corrected_at          REAL    NOT NULL   -- unix timestamp of this write
"""

import sqlite3
import threading
import time
import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)

# Dedicated audit logger — route to a file or SIEM in production so that
# no correction event can silently disappear from the audit trail.
_audit = logging.getLogger(__name__ + ".audit")


# ── Data types ─────────────────────────────────────────────────────────────────

@dataclass
class CorrectionRecord:
    """
    A single immutable correction audit row.

    Fields
    ------
    id                     — auto-assigned primary key.
    employee_id            — the employee whose record was changed.
    record_date            — "YYYY-MM-DD" of the attendance record that changed.
    original_check_in      — check_in_time before the edit (None if was absent).
    original_check_out     — check_out_time before the edit (None if not recorded).
    updated_check_in       — new check_in_time after the edit.
    updated_check_out      — new check_out_time after the edit.
    admin_user             — name or ID of the admin who authorised the change.
    verification_timestamp — when the camera re-verification was completed.
    verification_image_path — path to the JPEG saved during re-verification.
    corrected_at           — when this correction row was written.
    """
    id:                      int
    employee_id:             str
    record_date:             str            # "YYYY-MM-DD"
    original_check_in:       Optional[float]
    original_check_out:      Optional[float]
    updated_check_in:        Optional[float]
    updated_check_out:       Optional[float]
    admin_user:              str
    verification_timestamp:  float
    verification_image_path: str
    corrected_at:            float


# ── Store ──────────────────────────────────────────────────────────────────────

class CorrectionStore:
    """
    Thread-safe, SQLite-backed audit log for attendance corrections.

    Usage
    -----
        store = CorrectionStore("corrections.db")
        store.add_correction(
            employee_id="EMP001",
            record_date="2026-04-06",
            original_check_in=1744000000.0,
            ...
        )

    The database file is created automatically on first use.
    Pass ":memory:" for an isolated in-memory database in tests.
    """

    def __init__(self, db_path: str = "corrections.db") -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        # Persistent connection for ":memory:" (new connections open empty DBs).
        self._mem_conn: Optional[sqlite3.Connection] = None
        if db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _close(self, conn: sqlite3.Connection) -> None:
        if self._mem_conn is None:
            conn.close()

    def _init_db(self) -> None:
        """Create the corrections table if it does not already exist."""
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS corrections (
                        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                        employee_id             TEXT    NOT NULL,
                        record_date             TEXT    NOT NULL,
                        original_check_in       REAL,
                        original_check_out      REAL,
                        updated_check_in        REAL,
                        updated_check_out       REAL,
                        admin_user              TEXT    NOT NULL,
                        verification_timestamp  REAL    NOT NULL,
                        verification_image_path TEXT    NOT NULL,
                        corrected_at            REAL    NOT NULL
                    )
                """)
                conn.commit()
            finally:
                self._close(conn)
        logger.info("CorrectionStore ready (db=%s).", self._db_path)

    # ── Write ──────────────────────────────────────────────────────────────────

    def add_correction(
        self,
        employee_id:             str,
        record_date:             str,
        original_check_in:       Optional[float],
        original_check_out:      Optional[float],
        updated_check_in:        Optional[float],
        updated_check_out:       Optional[float],
        admin_user:              str,
        verification_timestamp:  float,
        verification_image_path: str,
    ) -> CorrectionRecord:
        """
        Insert a new correction audit row.

        This is the only write method — correction rows are never updated or
        deleted.  Multiple corrections on the same (employee_id, record_date)
        pair each produce their own row, giving a complete chain of custody.

        Returns
        -------
        The newly created CorrectionRecord with its auto-assigned id.
        """
        corrected_at = time.time()

        with self._lock:
            conn = self._connect()
            try:
                cur = conn.execute(
                    """
                    INSERT INTO corrections (
                        employee_id, record_date,
                        original_check_in, original_check_out,
                        updated_check_in,  updated_check_out,
                        admin_user, verification_timestamp,
                        verification_image_path, corrected_at
                    ) VALUES (?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        employee_id, record_date,
                        original_check_in, original_check_out,
                        updated_check_in,  updated_check_out,
                        admin_user, verification_timestamp,
                        verification_image_path, corrected_at,
                    ),
                )
                conn.commit()
                new_id = cur.lastrowid
            finally:
                self._close(conn)

        rec = CorrectionRecord(
            id=new_id,
            employee_id=employee_id,
            record_date=record_date,
            original_check_in=original_check_in,
            original_check_out=original_check_out,
            updated_check_in=updated_check_in,
            updated_check_out=updated_check_out,
            admin_user=admin_user,
            verification_timestamp=verification_timestamp,
            verification_image_path=verification_image_path,
            corrected_at=corrected_at,
        )

        # Emit a structured audit log entry.  Route __name__ + ".audit" to a
        # separate file handler in production for tamper-evident log storage.
        _audit.info(
            "CORRECTION: id=%d  employee=%s  date=%s  "
            "check_in: %s → %s  check_out: %s → %s  "
            "admin=%r  verified_at=%.3f  image=%s",
            new_id,
            employee_id,
            record_date,
            _fmt_ts(original_check_in), _fmt_ts(updated_check_in),
            _fmt_ts(original_check_out), _fmt_ts(updated_check_out),
            admin_user,
            verification_timestamp,
            verification_image_path,
        )
        return rec

    # ── Read ───────────────────────────────────────────────────────────────────

    def get_all(self) -> List[CorrectionRecord]:
        """Return all correction records, newest first."""
        with self._lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    "SELECT * FROM corrections ORDER BY corrected_at DESC"
                ).fetchall()
            finally:
                self._close(conn)
        return [_row_to_record(r) for r in rows]

    def get_by_employee(self, employee_id: str) -> List[CorrectionRecord]:
        """Return all corrections for a specific employee, newest first."""
        with self._lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    "SELECT * FROM corrections WHERE employee_id = ? "
                    "ORDER BY corrected_at DESC",
                    (employee_id,),
                ).fetchall()
            finally:
                self._close(conn)
        return [_row_to_record(r) for r in rows]

    def get_by_date(self, record_date: str) -> List[CorrectionRecord]:
        """Return all corrections for a specific attendance date, newest first."""
        with self._lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    "SELECT * FROM corrections WHERE record_date = ? "
                    "ORDER BY corrected_at DESC",
                    (record_date,),
                ).fetchall()
            finally:
                self._close(conn)
        return [_row_to_record(r) for r in rows]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _row_to_record(r: sqlite3.Row) -> CorrectionRecord:
    return CorrectionRecord(
        id=r["id"],
        employee_id=r["employee_id"],
        record_date=r["record_date"],
        original_check_in=r["original_check_in"],
        original_check_out=r["original_check_out"],
        updated_check_in=r["updated_check_in"],
        updated_check_out=r["updated_check_out"],
        admin_user=r["admin_user"],
        verification_timestamp=r["verification_timestamp"],
        verification_image_path=r["verification_image_path"],
        corrected_at=r["corrected_at"],
    )


def _fmt_ts(ts: Optional[float]) -> str:
    """Format a unix timestamp for audit log readability, or '—' if None."""
    if ts is None:
        return "—"
    import datetime
    return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
