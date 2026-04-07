"""
holiday_store.py
----------------
SQLite-backed store for company holidays with CRUD operations, duplicate
prevention, and audit logging.

How the holiday table works
---------------------------
The `holidays` table is the single authoritative source for all company
holidays.  It is consulted by three parts of the system:

  1. AbsenceScheduler.run_absence_check()
     ─ Calls is_holiday(date) at the top of each daily run.
     ─ If the date is a holiday, the entire check is short-circuited and
       no absent records are created.  This prevents false-absent records
       on days when employees are legitimately not expected to come in.

  2. GET /attendance/records  (app.py)
     ─ After fetching all attendance records, the endpoint calls
       is_holiday(record.date) on each Absent record.
     ─ Absent records that fall on a holiday are surfaced to the client
       with status "Holiday" instead of "Absent".

  3. GET /admin/calendar  (app.py)
     ─ Returns holiday dates in a requested month range so the dashboard
       calendar can highlight those cells in a different colour.

Schema (created automatically on first use)
-------------------------------------------
  id            INTEGER PRIMARY KEY AUTOINCREMENT
  date          TEXT UNIQUE NOT NULL   -- ISO "YYYY-MM-DD"
  holiday_name  TEXT NOT NULL
  description   TEXT NOT NULL DEFAULT ''

Thread safety
-------------
All public methods acquire self._lock before opening a new SQLite
connection.  A fresh connection is created and closed inside each method
so no connection is ever shared across threads.
"""

import sqlite3
import threading
import logging
import datetime
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)

# Dedicated audit logger — in production route this to a separate file so
# administrators can review every holiday change without digging through
# the main application log.
_audit = logging.getLogger(__name__ + ".audit")


# ── Holiday record ─────────────────────────────────────────────────────────────

@dataclass
class Holiday:
    """
    A single holiday row returned from HolidayStore.

    Fields
    ------
    id           — auto-assigned integer primary key.
    date         — "YYYY-MM-DD" string (local calendar date).
    holiday_name — short display label (e.g. "Christmas Day").
    description  — optional free-text annotation.
    """
    id:           int
    date:         str     # "YYYY-MM-DD"
    holiday_name: str
    description:  str = ""


# ── Custom exception ───────────────────────────────────────────────────────────

class DuplicateHolidayError(ValueError):
    """
    Raised when an admin tries to add or update a holiday to a date that
    is already occupied by a different holiday record.

    This is caught by the API layer and returned as HTTP 409 Conflict so
    the admin UI can display a helpful message rather than a raw 500 error.
    """


# ── Main store ─────────────────────────────────────────────────────────────────

class HolidayStore:
    """
    Thread-safe, SQLite-backed store for company holidays.

    Responsibilities
    ----------------
    • Persist holidays across server restarts (SQLite file).
    • Prevent duplicate holidays on the same date (UNIQUE constraint +
      app-layer check for a user-friendly error message).
    • Provide fast is_holiday(date) lookups for the absence scheduler and
      reports endpoint.
    • Emit structured audit-log entries on every mutation (add / edit / delete)
      so changes are traceable without a separate audit table.

    Usage
    -----
        store = HolidayStore("holidays.db")
        store.add_holiday("2026-12-25", "Christmas Day")

        if store.is_holiday("2026-12-25"):
            print("Skipping absence check — public holiday.")

    Pass ":memory:" as db_path in unit tests to get a fresh, isolated database
    that disappears when the object is garbage-collected.
    """

    def __init__(self, db_path: str = "holidays.db") -> None:
        """
        Args:
            db_path: Path to the SQLite database file.  The file (and the
                     `holidays` table) are created automatically on first use.
                     Use ":memory:" in tests.

        In-memory vs. file-backed behaviour
        ------------------------------------
        SQLite ":memory:" databases are private to each connection object —
        a new sqlite3.connect(":memory:") call opens a completely fresh,
        empty database.  To keep ":memory:" useful in tests, the store holds
        a single persistent connection when db_path is ":memory:" and reuses
        it for every call.  File-backed databases open and close a connection
        per call to avoid holding a file descriptor longer than necessary.
        """
        self._db_path = db_path
        self._lock = threading.Lock()
        # Persistent connection used only for ":memory:" databases.
        self._mem_conn: Optional[sqlite3.Connection] = None
        if db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
        self._init_db()

    # ── Database initialisation ────────────────────────────────────────────────

    def _init_db(self) -> None:
        """
        Create the `holidays` table if it does not already exist.

        The UNIQUE constraint on `date` is a safety net against concurrent
        INSERTs that both pass the app-layer duplicate check before either
        has committed.  In practice the module-level lock prevents this, but
        the constraint gives defence-in-depth.
        """
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS holidays (
                        id           INTEGER PRIMARY KEY AUTOINCREMENT,
                        date         TEXT    UNIQUE NOT NULL,
                        holiday_name TEXT    NOT NULL,
                        description  TEXT    NOT NULL DEFAULT ''
                    )
                """)
                conn.commit()
            finally:
                if self._mem_conn is None:
                    conn.close()
        logger.info("HolidayStore ready (db=%s).", self._db_path)

    # ── Internal connection helper ─────────────────────────────────────────────

    def _connect(self) -> sqlite3.Connection:
        """
        Return a SQLite connection.

        For ":memory:" databases the same persistent connection is returned
        every time so all method calls share the same in-memory database.
        For file-backed databases a new connection is opened; the caller is
        responsible for closing it (always done in a try/finally block).
        """
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ── CRUD — Add ─────────────────────────────────────────────────────────────

    def add_holiday(
        self,
        date: str,
        holiday_name: str,
        description: str = "",
    ) -> Holiday:
        """
        Insert a new holiday record.

        Args:
            date         : "YYYY-MM-DD" calendar date.  A ValueError is raised
                           immediately if the format is invalid so bad data is
                           rejected before reaching the database.
            holiday_name : Short display label for the holiday.
            description  : Optional longer description (stored as empty string
                           when omitted).

        Returns:
            The newly created Holiday with its auto-assigned id.

        Raises:
            ValueError            — if date is not a valid ISO date.
            DuplicateHolidayError — if a holiday already exists on that date.

        Duplicate prevention
        --------------------
        The method queries for an existing record on `date` under the lock
        before issuing the INSERT.  This gives a clear DuplicateHolidayError
        with a human-friendly message rather than a raw sqlite3.IntegrityError.
        The UNIQUE constraint on the column remains as a safety net.
        """
        # Validate format early — raises ValueError on bad input.
        datetime.date.fromisoformat(date)

        with self._lock:
            conn = self._connect()
            try:
                # App-layer duplicate check for a friendly error message.
                existing = conn.execute(
                    "SELECT id FROM holidays WHERE date = ?", (date,)
                ).fetchone()
                if existing is not None:
                    raise DuplicateHolidayError(
                        f"A holiday already exists on {date}."
                    )

                cur = conn.execute(
                    "INSERT INTO holidays (date, holiday_name, description) "
                    "VALUES (?, ?, ?)",
                    (date, holiday_name, description),
                )
                conn.commit()
                new_id = cur.lastrowid
            finally:
                if self._mem_conn is None:
                    conn.close()

        holiday = Holiday(
            id=new_id,
            date=date,
            holiday_name=holiday_name,
            description=description,
        )
        _audit.info(
            "HOLIDAY ADDED: id=%d  date=%s  name=%r  description=%r",
            holiday.id,
            holiday.date,
            holiday.holiday_name,
            holiday.description,
        )
        return holiday

    # ── CRUD — Update ──────────────────────────────────────────────────────────

    def update_holiday(
        self,
        holiday_id: int,
        date: str,
        holiday_name: str,
        description: str = "",
    ) -> Optional[Holiday]:
        """
        Update an existing holiday identified by `holiday_id`.

        Args:
            holiday_id   : Primary key of the record to update.
            date         : New calendar date ("YYYY-MM-DD").
            holiday_name : New display name.
            description  : New description (pass empty string to clear it).

        Returns:
            The updated Holiday, or None if no record with holiday_id exists.

        Raises:
            ValueError            — if date is not a valid ISO date.
            DuplicateHolidayError — if the new date is already taken by a
                                    *different* holiday record.
        """
        datetime.date.fromisoformat(date)

        with self._lock:
            conn = self._connect()
            try:
                # Fetch the existing record to confirm it exists and to log
                # the old values in the audit trail.
                old = conn.execute(
                    "SELECT id, date, holiday_name, description "
                    "FROM holidays WHERE id = ?",
                    (holiday_id,),
                ).fetchone()
                if old is None:
                    return None

                # Check whether the new date conflicts with a DIFFERENT record.
                collision = conn.execute(
                    "SELECT id FROM holidays WHERE date = ? AND id != ?",
                    (date, holiday_id),
                ).fetchone()
                if collision is not None:
                    raise DuplicateHolidayError(
                        f"A different holiday already exists on {date}."
                    )

                conn.execute(
                    "UPDATE holidays SET date=?, holiday_name=?, description=? "
                    "WHERE id=?",
                    (date, holiday_name, description, holiday_id),
                )
                conn.commit()
            finally:
                if self._mem_conn is None:
                    conn.close()

        holiday = Holiday(
            id=holiday_id,
            date=date,
            holiday_name=holiday_name,
            description=description,
        )
        _audit.info(
            "HOLIDAY UPDATED: id=%d  "
            "date: %s → %s  name: %r → %r  description: %r → %r",
            holiday_id,
            old["date"], date,
            old["holiday_name"], holiday_name,
            old["description"], description,
        )
        return holiday

    # ── CRUD — Delete ──────────────────────────────────────────────────────────

    def delete_holiday(self, holiday_id: int) -> bool:
        """
        Delete the holiday with the given id.

        Returns:
            True  — record was found and deleted.
            False — no record with that id existed (idempotent no-op).
        """
        with self._lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    "SELECT id, date, holiday_name FROM holidays WHERE id = ?",
                    (holiday_id,),
                ).fetchone()
                if row is None:
                    return False

                conn.execute("DELETE FROM holidays WHERE id = ?", (holiday_id,))
                conn.commit()
            finally:
                if self._mem_conn is None:
                    conn.close()

        _audit.info(
            "HOLIDAY DELETED: id=%d  date=%s  name=%r",
            row["id"],
            row["date"],
            row["holiday_name"],
        )
        return True

    # ── Query helpers ──────────────────────────────────────────────────────────

    def get_all(self) -> List[Holiday]:
        """Return every holiday sorted by date ascending."""
        with self._lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    "SELECT id, date, holiday_name, description "
                    "FROM holidays ORDER BY date ASC"
                ).fetchall()
            finally:
                if self._mem_conn is None:
                    conn.close()
        return [
            Holiday(id=r["id"], date=r["date"],
                    holiday_name=r["holiday_name"], description=r["description"])
            for r in rows
        ]

    def get_by_id(self, holiday_id: int) -> Optional[Holiday]:
        """Return the holiday with the given primary key, or None."""
        with self._lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    "SELECT id, date, holiday_name, description "
                    "FROM holidays WHERE id = ?",
                    (holiday_id,),
                ).fetchone()
            finally:
                if self._mem_conn is None:
                    conn.close()
        if row is None:
            return None
        return Holiday(
            id=row["id"], date=row["date"],
            holiday_name=row["holiday_name"], description=row["description"]
        )

    def get_by_date(self, date: str) -> Optional[Holiday]:
        """Return the holiday on a specific date, or None."""
        with self._lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    "SELECT id, date, holiday_name, description "
                    "FROM holidays WHERE date = ?",
                    (date,),
                ).fetchone()
            finally:
                if self._mem_conn is None:
                    conn.close()
        if row is None:
            return None
        return Holiday(
            id=row["id"], date=row["date"],
            holiday_name=row["holiday_name"], description=row["description"]
        )

    def is_holiday(self, date: str) -> bool:
        """
        Return True if `date` ("YYYY-MM-DD") is a recorded holiday.

        This is the hot path called by:
          • AbsenceScheduler at the start of every daily run.
          • The /attendance/records endpoint for each absent record.

        It does a minimal SELECT rather than constructing a full Holiday
        object, keeping the critical path as fast as possible.
        """
        with self._lock:
            conn = self._connect()
            try:
                row = conn.execute(
                    "SELECT 1 FROM holidays WHERE date = ?", (date,)
                ).fetchone()
            finally:
                if self._mem_conn is None:
                    conn.close()
        return row is not None

    def get_dates_in_range(self, start_date: str, end_date: str) -> List[str]:
        """
        Return all holiday dates (as "YYYY-MM-DD" strings) in the closed
        interval [start_date, end_date], sorted ascending.

        Used by the dashboard calendar endpoint to highlight holiday cells
        without transferring full Holiday objects.

        Args:
            start_date : First date of the range, inclusive ("YYYY-MM-DD").
            end_date   : Last date of the range, inclusive ("YYYY-MM-DD").
        """
        with self._lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    "SELECT date FROM holidays "
                    "WHERE date >= ? AND date <= ? ORDER BY date ASC",
                    (start_date, end_date),
                ).fetchall()
            finally:
                if self._mem_conn is None:
                    conn.close()
        return [r["date"] for r in rows]
