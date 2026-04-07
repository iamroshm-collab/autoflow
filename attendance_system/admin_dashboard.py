"""
admin_dashboard.py
------------------
FastAPI APIRouter that provides the Holiday Management section of the admin
dashboard.

Two surfaces are exposed:

  HTML interface  — GET /admin/holidays
      A self-contained HTML page (vanilla JS, no external CDN) that lets
      administrators list, add, edit, and delete holidays entirely in the
      browser.  The page communicates with the JSON endpoints below via
      fetch() calls.

  JSON API  — /admin/holidays (CRUD endpoints)
      Consumed by the HTML page above.  Also usable by scripts, CI jobs,
      or a future React/Vue frontend.

How the dashboard integrates with holiday data
----------------------------------------------
The HTML page calls:
  • GET  /admin/holidays        → fetches the current holiday list on load.
  • POST /admin/holidays        → submits a new holiday form.
  • PUT  /admin/holidays/{id}   → submits an edited holiday form.
  • DELETE /admin/holidays/{id} → triggered by the "Delete" button.

After every mutating call the page re-fetches the list and re-renders the
table, so the view is always consistent with the database.

Registering this router in app.py
----------------------------------
    from .admin_dashboard import make_holiday_router
    app.include_router(make_holiday_router(holiday_store))

The router is constructed with a HolidayStore instance injected at creation
time rather than using FastAPI dependency injection, so no global state is
required.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .holiday_store import HolidayStore, DuplicateHolidayError

logger = logging.getLogger(__name__)


# ── Pydantic request models ────────────────────────────────────────────────────

class HolidayCreateRequest(BaseModel):
    """Body for POST /admin/holidays."""
    date:         str            # "YYYY-MM-DD"
    holiday_name: str
    description:  Optional[str] = ""


class HolidayUpdateRequest(BaseModel):
    """Body for PUT /admin/holidays/{id}."""
    date:         str
    holiday_name: str
    description:  Optional[str] = ""


# ── Router factory ─────────────────────────────────────────────────────────────

def make_holiday_router(holiday_store: HolidayStore) -> APIRouter:
    """
    Build and return the /admin router with `holiday_store` captured in the
    closure.  This avoids global state and makes the router fully testable by
    passing a store backed by ":memory:".

    Args:
        holiday_store: The application's shared HolidayStore instance.

    Returns:
        A FastAPI APIRouter pre-configured with all holiday management routes.
    """
    router = APIRouter(prefix="/admin", tags=["admin"])

    # ── HTML page ──────────────────────────────────────────────────────────────

    @router.get("/holidays", response_class=HTMLResponse)
    async def holiday_dashboard() -> HTMLResponse:
        """
        Serve the Holiday Management admin page.

        The page is entirely self-contained — no external CDN dependencies.
        JavaScript communicates with the JSON API below via fetch().

        Dashboard integration
        ---------------------
        The calendar section at the bottom of this page calls
        GET /admin/calendar?year=YYYY&month=MM to get the holiday dates for
        the currently displayed month and highlights those cells in amber.
        This gives admins an immediate visual confirmation that their
        holidays are reflected in the calendar view.
        """
        html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Holiday Management — Admin Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #f4f6f9; color: #222; }
  header { background: #1a56db; color: #fff; padding: 1rem 2rem; }
  header h1 { font-size: 1.4rem; }
  main { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
  section { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.1);
            padding: 1.5rem; margin-bottom: 2rem; }
  h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #1a56db; }
  label { display: block; font-size: .875rem; margin-bottom: .25rem; font-weight: 500; }
  input[type=date], input[type=text], textarea {
    width: 100%; padding: .5rem .75rem; border: 1px solid #d1d5db;
    border-radius: 6px; font-size: .95rem; margin-bottom: .75rem; }
  textarea { resize: vertical; min-height: 60px; }
  .btn { padding: .5rem 1.1rem; border: none; border-radius: 6px;
         cursor: pointer; font-size: .9rem; font-weight: 500; }
  .btn-primary { background: #1a56db; color: #fff; }
  .btn-primary:hover { background: #1648c0; }
  .btn-danger  { background: #e02424; color: #fff; }
  .btn-danger:hover  { background: #c81e1e; }
  .btn-secondary { background: #6b7280; color: #fff; }
  .btn-secondary:hover { background: #4b5563; }
  .btn-sm { padding: .3rem .7rem; font-size: .8rem; }
  .row { display: flex; gap: .75rem; }
  .row > * { flex: 1; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th { background: #f9fafb; text-align: left; padding: .6rem .75rem;
       border-bottom: 2px solid #e5e7eb; font-weight: 600; }
  td { padding: .6rem .75rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:hover td { background: #f9fafb; }
  .badge { display: inline-block; padding: .15rem .5rem; border-radius: 9999px;
           font-size: .75rem; font-weight: 600; }
  .badge-holiday { background: #fef3c7; color: #92400e; }
  .msg { padding: .6rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: .9rem; }
  .msg-ok  { background: #d1fae5; color: #065f46; }
  .msg-err { background: #fee2e2; color: #991b1b; }
  /* Calendar */
  .cal-nav { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .cal-nav button { background: none; border: 1px solid #d1d5db; border-radius: 6px;
                    padding: .3rem .7rem; cursor: pointer; font-size: 1rem; }
  .cal-nav span { font-weight: 600; min-width: 130px; text-align: center; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .cal-day-header { text-align: center; font-size: .75rem; font-weight: 600;
                    color: #6b7280; padding: .3rem 0; }
  .cal-day { text-align: center; padding: .5rem .25rem; border-radius: 6px;
             font-size: .85rem; min-height: 2.5rem; cursor: default; }
  .cal-day.other-month { color: #d1d5db; }
  .cal-day.today { border: 2px solid #1a56db; font-weight: 700; }
  .cal-day.holiday { background: #fef3c7; color: #92400e; font-weight: 600; }
  .cal-day.holiday:hover { background: #fde68a; }
</style>
</head>
<body>
<header>
  <h1>Holiday Management — Admin Dashboard</h1>
</header>
<main>

  <!-- Flash message area -->
  <div id="flash" style="display:none" class="msg"></div>

  <!-- Add / Edit form -->
  <section>
    <h2 id="form-title">Add Holiday</h2>
    <form id="holiday-form" onsubmit="submitForm(event)">
      <input type="hidden" id="edit-id" value="">
      <div class="row">
        <div>
          <label for="h-date">Date</label>
          <input type="date" id="h-date" required>
        </div>
        <div>
          <label for="h-name">Holiday Name</label>
          <input type="text" id="h-name" placeholder="e.g. Christmas Day" required>
        </div>
      </div>
      <label for="h-desc">Description (optional)</label>
      <textarea id="h-desc" placeholder="Additional details..."></textarea>
      <div style="display:flex; gap:.75rem">
        <button type="submit" class="btn btn-primary" id="submit-btn">Add Holiday</button>
        <button type="button" class="btn btn-secondary" id="cancel-btn"
                onclick="resetForm()" style="display:none">Cancel</button>
      </div>
    </form>
  </section>

  <!-- Holiday list table -->
  <section>
    <h2>Holidays</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Holiday Name</th>
          <th>Description</th>
          <th style="width:130px">Actions</th>
        </tr>
      </thead>
      <tbody id="holidays-tbody">
        <tr><td colspan="4" style="text-align:center;color:#9ca3af">Loading…</td></tr>
      </tbody>
    </table>
  </section>

  <!-- Calendar section — highlights holidays in the current month -->
  <section>
    <h2>Calendar View</h2>
    <div class="cal-nav">
      <button onclick="changeMonth(-1)">&#8592;</button>
      <span id="cal-label"></span>
      <button onclick="changeMonth(1)">&#8594;</button>
    </div>
    <div class="cal-grid" id="cal-grid"></div>
    <p style="margin-top:.75rem;font-size:.8rem;color:#6b7280">
      <span style="display:inline-block;width:12px;height:12px;
             background:#fef3c7;border-radius:3px;margin-right:4px"></span>
      Holiday date
    </p>
  </section>

</main>

<script>
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const TODAY  = new Date();
let calYear  = TODAY.getFullYear();
let calMonth = TODAY.getMonth(); // 0-based

// ── Helpers ──────────────────────────────────────────────────────────────────

function flash(msg, ok) {
  const el = document.getElementById('flash');
  el.textContent  = msg;
  el.className    = 'msg ' + (ok ? 'msg-ok' : 'msg-err');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDate(iso) {
  // "2026-04-14" → "14 Apr 2026"
  const [y, m, d] = iso.split('-');
  return d + ' ' + MONTHS[parseInt(m,10)-1].slice(0,3) + ' ' + y;
}

// ── Holiday list ─────────────────────────────────────────────────────────────

async function loadHolidays() {
  const res  = await fetch('/admin/holidays/list');
  const data = await res.json();
  const tbody = document.getElementById('holidays-tbody');

  if (!data.holidays.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9ca3af">'
                    + 'No holidays configured yet.</td></tr>';
    return;
  }

  tbody.innerHTML = data.holidays.map(h => `
    <tr>
      <td><span class="badge badge-holiday">${fmtDate(h.date)}</span></td>
      <td>${esc(h.holiday_name)}</td>
      <td style="color:#6b7280">${esc(h.description)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editHoliday(${h.id},'${h.date}',
          ${JSON.stringify(h.holiday_name)},${JSON.stringify(h.description)})">Edit</button>
        &nbsp;
        <button class="btn btn-sm btn-danger" onclick="deleteHoliday(${h.id},'${h.date}',
          ${JSON.stringify(h.holiday_name)})">Delete</button>
      </td>
    </tr>`).join('');
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Form actions ─────────────────────────────────────────────────────────────

async function submitForm(e) {
  e.preventDefault();
  const id   = document.getElementById('edit-id').value;
  const body = {
    date:         document.getElementById('h-date').value,
    holiday_name: document.getElementById('h-name').value.trim(),
    description:  document.getElementById('h-desc').value.trim(),
  };

  const url    = id ? `/admin/holidays/${id}` : '/admin/holidays';
  const method = id ? 'PUT' : 'POST';
  const res    = await fetch(url, {
    method, headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    flash(data.detail || 'An error occurred.', false);
    return;
  }

  flash(id ? 'Holiday updated.' : 'Holiday added.', true);
  resetForm();
  loadHolidays();
  renderCalendar();
}

function editHoliday(id, date, name, desc) {
  document.getElementById('edit-id').value   = id;
  document.getElementById('h-date').value    = date;
  document.getElementById('h-name').value    = name;
  document.getElementById('h-desc').value    = desc;
  document.getElementById('form-title').textContent = 'Edit Holiday';
  document.getElementById('submit-btn').textContent  = 'Save Changes';
  document.getElementById('cancel-btn').style.display = 'inline-block';
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function resetForm() {
  document.getElementById('edit-id').value  = '';
  document.getElementById('h-date').value   = '';
  document.getElementById('h-name').value   = '';
  document.getElementById('h-desc').value   = '';
  document.getElementById('form-title').textContent   = 'Add Holiday';
  document.getElementById('submit-btn').textContent   = 'Add Holiday';
  document.getElementById('cancel-btn').style.display = 'none';
}

async function deleteHoliday(id, date, name) {
  if (!confirm(`Delete "${name}" (${fmtDate(date)})?`)) return;
  const res  = await fetch(`/admin/holidays/${id}`, {method:'DELETE'});
  const data = await res.json();
  if (!res.ok) { flash(data.detail || 'Delete failed.', false); return; }
  flash('Holiday deleted.', true);
  loadHolidays();
  renderCalendar();
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function changeMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}

async function renderCalendar() {
  document.getElementById('cal-label').textContent =
    MONTHS[calMonth] + ' ' + calYear;

  // Build start/end dates for the month.
  const y  = calYear, m = calMonth + 1;
  const startDate = `${y}-${pad(m)}-01`;
  const lastDay   = new Date(y, m, 0).getDate();
  const endDate   = `${y}-${pad(m)}-${pad(lastDay)}`;

  // Fetch holiday dates for this month from the server.
  const res  = await fetch(`/admin/calendar?start=${startDate}&end=${endDate}`);
  const data = await res.json();
  const holidaySet = new Set(data.holiday_dates);

  // Build the calendar grid.
  const firstWeekday = new Date(y, calMonth, 1).getDay(); // 0=Sun
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Day headers.
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-header';
    el.textContent = d;
    grid.appendChild(el);
  });

  const todayISO = `${TODAY.getFullYear()}-${pad(TODAY.getMonth()+1)}-${pad(TODAY.getDate())}`;

  // Leading empty cells.
  for (let i = 0; i < firstWeekday; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day other-month';
    grid.appendChild(el);
  }

  // Day cells.
  for (let d = 1; d <= lastDay; d++) {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const el  = document.createElement('div');
    let cls = 'cal-day';
    if (iso === todayISO)       cls += ' today';
    if (holidaySet.has(iso))    cls += ' holiday';
    el.className   = cls;
    el.textContent = d;
    if (holidaySet.has(iso)) {
      // Show holiday name on hover via title attribute.
      el.title = data.holidays_by_date[iso] || 'Holiday';
    }
    grid.appendChild(el);
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────
loadHolidays();
renderCalendar();
</script>
</body>
</html>"""
        return HTMLResponse(content=html)

    # ── JSON API ───────────────────────────────────────────────────────────────

    @router.get("/holidays/list")
    async def list_holidays() -> dict:
        """
        Return all holidays sorted by date ascending.

        Response shape
        --------------
        {
          "count": <int>,
          "holidays": [
            {"id": 1, "date": "2026-12-25",
             "holiday_name": "Christmas Day", "description": ""},
            ...
          ]
        }
        """
        holidays = holiday_store.get_all()
        return {
            "count": len(holidays),
            "holidays": [
                {
                    "id":           h.id,
                    "date":         h.date,
                    "holiday_name": h.holiday_name,
                    "description":  h.description,
                }
                for h in holidays
            ],
        }

    @router.post("/holidays", status_code=status.HTTP_201_CREATED)
    async def add_holiday(req: HolidayCreateRequest) -> dict:
        """
        Create a new holiday.

        Returns HTTP 201 with the created holiday on success.
        Returns HTTP 409 if a holiday already exists on the requested date.
        Returns HTTP 422 if the date format is invalid.

        The date field must be a valid ISO date string ("YYYY-MM-DD").
        Duplicate dates are rejected with a clear error message so the
        admin UI can surface it without parsing a stack trace.
        """
        try:
            holiday = holiday_store.add_holiday(
                date=req.date,
                holiday_name=req.holiday_name.strip(),
                description=(req.description or "").strip(),
            )
        except DuplicateHolidayError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid date format: {exc}",
            )

        logger.info("Admin added holiday: id=%d  date=%s  name=%r",
                    holiday.id, holiday.date, holiday.holiday_name)
        return {
            "id":           holiday.id,
            "date":         holiday.date,
            "holiday_name": holiday.holiday_name,
            "description":  holiday.description,
        }

    @router.put("/holidays/{holiday_id}")
    async def update_holiday(
        holiday_id: int,
        req: HolidayUpdateRequest,
    ) -> dict:
        """
        Update an existing holiday.

        Path parameter:
            holiday_id — primary key of the holiday to update.

        Returns HTTP 200 with the updated holiday on success.
        Returns HTTP 404 if no holiday with that id exists.
        Returns HTTP 409 if the new date is already taken by another holiday.
        """
        try:
            holiday = holiday_store.update_holiday(
                holiday_id=holiday_id,
                date=req.date,
                holiday_name=req.holiday_name.strip(),
                description=(req.description or "").strip(),
            )
        except DuplicateHolidayError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid date format: {exc}",
            )

        if holiday is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No holiday found with id={holiday_id}.",
            )

        logger.info("Admin updated holiday: id=%d  date=%s  name=%r",
                    holiday.id, holiday.date, holiday.holiday_name)
        return {
            "id":           holiday.id,
            "date":         holiday.date,
            "holiday_name": holiday.holiday_name,
            "description":  holiday.description,
        }

    @router.delete("/holidays/{holiday_id}")
    async def delete_holiday(holiday_id: int) -> dict:
        """
        Delete a holiday by id.

        Returns HTTP 200 with a confirmation message on success.
        Returns HTTP 404 if no holiday with that id exists.
        """
        deleted = holiday_store.delete_holiday(holiday_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No holiday found with id={holiday_id}.",
            )

        logger.info("Admin deleted holiday: id=%d", holiday_id)
        return {"message": f"Holiday {holiday_id} deleted successfully."}

    # ── Attendance Edit page ───────────────────────────────────────────────────

    @router.get("/attendance-edit", response_class=HTMLResponse)
    async def attendance_edit_dashboard() -> HTMLResponse:
        """
        Serve the Attendance Edit admin page with camera re-verification.

        Dashboard integration with the verification workflow
        -----------------------------------------------------
        The page implements a strict three-step flow enforced both in the UI
        and by the server-side token system:

          Step 1 — Select record
            The page loads all attendance records via GET /attendance/records.
            The admin clicks "Edit" on any row → the edit panel opens.

          Step 2 — Verify employee  (the "Verify Employee" button)
            The button calls POST /admin/corrections/verify/{employee_id}.
            The server runs the FULL face recognition pipeline
            (stability → multi-frame → tailgating → voting → threshold).
            • On success: the server returns a one-time token; the JS stores
              it in memory and enables the time-input fields.
            • On failure: "Employee verification failed" is displayed and the
              form remains locked.

          Step 3 — Apply correction
            The admin fills in new HH:MM times and submits.
            POST /admin/corrections/apply sends the token + new times.
            The server validates the token, updates the record, and writes
            an immutable audit row (CorrectionStore).

        The audit log table at the bottom of the page shows all past
        corrections for transparency.
        """
        html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Attendance Edit — Admin Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #f4f6f9; color: #222; }
  header { background: #1a56db; color: #fff; padding: 1rem 2rem;
           display: flex; align-items: center; gap: 1.5rem; }
  header h1 { font-size: 1.4rem; }
  header a { color: #bfdbfe; font-size: .875rem; text-decoration: none; }
  header a:hover { color: #fff; text-decoration: underline; }
  main { max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
  section { background: #fff; border-radius: 8px;
            box-shadow: 0 1px 4px rgba(0,0,0,.1);
            padding: 1.5rem; margin-bottom: 2rem; }
  h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #1a56db; }
  label { display: block; font-size: .875rem; margin-bottom: .25rem; font-weight: 500; }
  input[type=time], input[type=text] {
    padding: .5rem .75rem; border: 1px solid #d1d5db;
    border-radius: 6px; font-size: .95rem; width: 100%; margin-bottom: .75rem; }
  input:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }
  .btn { padding: .5rem 1.1rem; border: none; border-radius: 6px;
         cursor: pointer; font-size: .9rem; font-weight: 500; }
  .btn-primary   { background: #1a56db; color: #fff; }
  .btn-primary:hover   { background: #1648c0; }
  .btn-success   { background: #057a55; color: #fff; }
  .btn-success:hover   { background: #046c4e; }
  .btn-warning   { background: #d97706; color: #fff; }
  .btn-warning:hover   { background: #b45309; }
  .btn-secondary { background: #6b7280; color: #fff; }
  .btn-secondary:hover { background: #4b5563; }
  .btn-sm { padding: .3rem .7rem; font-size: .8rem; }
  .btn:disabled { opacity: .45; cursor: not-allowed; }
  .row { display: flex; gap: .75rem; }
  .row > * { flex: 1; }
  table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  th { background: #f9fafb; text-align: left; padding: .6rem .75rem;
       border-bottom: 2px solid #e5e7eb; font-weight: 600; }
  td { padding: .6rem .75rem; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tr:hover td { background: #f9fafb; }
  .badge { display: inline-block; padding: .15rem .5rem; border-radius: 9999px;
           font-size: .75rem; font-weight: 600; }
  .badge-on-time    { background: #d1fae5; color: #065f46; }
  .badge-late       { background: #fef3c7; color: #92400e; }
  .badge-early      { background: #ffedd5; color: #9a3412; }
  .badge-overtime   { background: #dbeafe; color: #1e40af; }
  .badge-absent     { background: #fee2e2; color: #991b1b; }
  .badge-holiday    { background: #fef3c7; color: #92400e; }
  .msg { padding: .6rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: .875rem; }
  .msg-ok  { background: #d1fae5; color: #065f46; }
  .msg-err { background: #fee2e2; color: #991b1b; }
  .msg-info { background: #dbeafe; color: #1e40af; }
  .panel { border: 2px solid #e5e7eb; border-radius: 8px; padding: 1.25rem;
           margin-top: 1rem; }
  .panel.verified { border-color: #057a55; background: #f0fdf4; }
  .step-badge { display: inline-flex; align-items: center; justify-content: center;
                width: 24px; height: 24px; border-radius: 50%;
                background: #1a56db; color: #fff;
                font-size: .75rem; font-weight: 700; margin-right: .5rem; }
  .step-badge.done { background: #057a55; }
  .verify-status { padding: .5rem .75rem; border-radius: 6px; font-size: .875rem;
                   margin-bottom: .75rem; }
  .verify-status.pending  { background: #fef3c7; color: #92400e; }
  .verify-status.success  { background: #d1fae5; color: #065f46; }
  .verify-status.fail     { background: #fee2e2; color: #991b1b; }
  .verify-status.running  { background: #dbeafe; color: #1e40af; }
  #filter-input { padding: .4rem .75rem; border: 1px solid #d1d5db;
                  border-radius: 6px; font-size: .875rem; width: 260px; }
  .search-row { display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem; }
</style>
</head>
<body>
<header>
  <h1>Attendance Edit</h1>
  <a href="/admin/holidays">Holiday Management</a>
</header>
<main>

<!-- Flash -->
<div id="flash" style="display:none" class="msg"></div>

<!-- Step 1: Records table -->
<section>
  <h2><span class="step-badge" id="s1-badge">1</span>Select Attendance Record</h2>
  <div class="search-row">
    <input id="filter-input" type="text" placeholder="Filter by employee ID…"
           oninput="filterTable()">
    <button class="btn btn-secondary btn-sm" onclick="loadRecords()">Refresh</button>
  </div>
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>Employee</th><th>Date</th><th>Check-In</th><th>Check-Out</th>
          <th>Status</th><th style="width:80px">Action</th>
        </tr>
      </thead>
      <tbody id="records-tbody">
        <tr><td colspan="6" style="text-align:center;color:#9ca3af">Loading…</td></tr>
      </tbody>
    </table>
  </div>
</section>

<!-- Step 2 + 3: Verify & Edit panel (shown after row is selected) -->
<section id="edit-section" style="display:none">
  <h2><span class="step-badge" id="s2-badge">2</span>Verify &amp; Edit Record</h2>

  <!-- Selected record summary -->
  <div class="panel" id="selected-summary">
    <strong id="sel-emp"></strong> &nbsp;|&nbsp; <span id="sel-date"></span>
    &nbsp;|&nbsp; Check-in: <span id="sel-ci">—</span>
    &nbsp;|&nbsp; Check-out: <span id="sel-co">—</span>
    &nbsp;|&nbsp; Status: <span id="sel-status"></span>
  </div>

  <!-- Verification block -->
  <div style="margin-top:1rem">
    <label><span class="step-badge" id="s2a-badge">2a</span>Employee must stand in front of the camera</label>
    <div id="verify-status" class="verify-status pending">
      Verification required — click "Verify Employee" to begin.
    </div>
    <button class="btn btn-warning" id="verify-btn" onclick="runVerification()">
      Verify Employee
    </button>
    <span id="verify-timer" style="margin-left:.75rem;font-size:.8rem;color:#6b7280"></span>
  </div>

  <!-- Edit form (locked until verified) -->
  <div style="margin-top:1.25rem">
    <label><span class="step-badge" id="s3-badge">3</span>Edit Times (enabled after verification)</label>
    <div class="row" style="margin-top:.5rem">
      <div>
        <label for="new-ci">New Check-In (HH:MM, 24-hour)</label>
        <input type="time" id="new-ci" disabled>
      </div>
      <div>
        <label for="new-co">New Check-Out (HH:MM, 24-hour)</label>
        <input type="time" id="new-co" disabled>
      </div>
    </div>
    <label for="admin-user">Admin Name / ID</label>
    <input type="text" id="admin-user" placeholder="Your name or admin ID" disabled>
    <div style="margin-top:.5rem;display:flex;gap:.75rem">
      <button class="btn btn-success" id="apply-btn" onclick="applyCorrection()" disabled>
        Apply Correction
      </button>
      <button class="btn btn-secondary" onclick="closeEditPanel()">Cancel</button>
    </div>
  </div>
</section>

<!-- Audit log -->
<section>
  <h2>Correction Audit Log</h2>
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>#</th><th>Employee</th><th>Date</th>
          <th>Original In</th><th>Updated In</th>
          <th>Original Out</th><th>Updated Out</th>
          <th>Admin</th><th>Verified At</th><th>Photo</th><th>Applied At</th>
        </tr>
      </thead>
      <tbody id="audit-tbody">
        <tr><td colspan="11" style="text-align:center;color:#9ca3af">Loading…</td></tr>
      </tbody>
    </table>
  </div>
</section>

</main>
<script>
// ── State ─────────────────────────────────────────────────────────────────────
let allRecords    = [];
let selectedEmp   = null;   // { employee_id, date, check_in_time, check_out_time }
let verifyToken   = null;   // one-time token from verify endpoint
let tokenExpiry   = null;   // unix timestamp
let timerInterval = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function flash(msg, type) {
  const el = document.getElementById('flash');
  el.textContent   = msg;
  el.className     = 'msg msg-' + type;  // ok | err | info
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtTs(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

function fmtDateTime(str) { return str ? str.replace('T',' ') : '—'; }

function statusBadge(s) {
  const cls = {
    'On Time'   : 'on-time',
    'Late'      : 'late',
    'Early Leave': 'early',
    'Overtime'  : 'overtime',
    'Absent'    : 'absent',
    'Holiday'   : 'holiday',
  }[s] || 'on-time';
  return `<span class="badge badge-${cls}">${esc(s)}</span>`;
}

// ── Load records ──────────────────────────────────────────────────────────────

async function loadRecords() {
  const res  = await fetch('/attendance/records');
  const data = await res.json();
  allRecords = data.records || [];
  renderTable(allRecords);
  loadAuditLog();
}

function filterTable() {
  const q = document.getElementById('filter-input').value.toLowerCase();
  renderTable(allRecords.filter(r => r.employee_id.toLowerCase().includes(q)));
}

function renderTable(records) {
  const tbody = document.getElementById('records-tbody');
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af">'
                    + 'No records found.</td></tr>';
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td><strong>${esc(r.employee_id)}</strong></td>
      <td>${esc(r.date)}</td>
      <td>${fmtTs(r.check_in_time)}</td>
      <td>${fmtTs(r.check_out_time)}</td>
      <td>${statusBadge(r.attendance_status)}</td>
      <td>
        <button class="btn btn-sm btn-primary"
          onclick="selectRecord(${JSON.stringify(JSON.stringify(r))})">
          Edit
        </button>
      </td>
    </tr>`).join('');
}

// ── Select a record for editing ───────────────────────────────────────────────

function selectRecord(rJson) {
  const r = JSON.parse(rJson);
  selectedEmp = r;
  verifyToken = null;
  tokenExpiry = null;
  clearInterval(timerInterval);

  // Populate summary row.
  document.getElementById('sel-emp').textContent    = r.employee_id;
  document.getElementById('sel-date').textContent   = r.date;
  document.getElementById('sel-ci').textContent     = fmtTs(r.check_in_time);
  document.getElementById('sel-co').textContent     = fmtTs(r.check_out_time);
  document.getElementById('sel-status').innerHTML   = statusBadge(r.attendance_status);

  // Pre-fill time inputs with current values (admin can adjust).
  if (r.check_in_time) {
    const d = new Date(r.check_in_time * 1000);
    document.getElementById('new-ci').value =
      String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  } else {
    document.getElementById('new-ci').value = '';
  }
  if (r.check_out_time) {
    const d = new Date(r.check_out_time * 1000);
    document.getElementById('new-co').value =
      String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  } else {
    document.getElementById('new-co').value = '';
  }

  // Lock the form — employee must verify first.
  setFormLocked(true);
  setVerifyStatus('pending', 'Verification required — click "Verify Employee" to begin.');
  document.getElementById('edit-section').style.display = 'block';
  document.getElementById('edit-section').scrollIntoView({behavior:'smooth'});
}

function closeEditPanel() {
  selectedEmp = null;
  verifyToken = null;
  clearInterval(timerInterval);
  document.getElementById('edit-section').style.display = 'none';
  document.getElementById('verify-timer').textContent = '';
}

// ── Verification ──────────────────────────────────────────────────────────────

function setFormLocked(locked) {
  ['new-ci','new-co','admin-user'].forEach(id => {
    document.getElementById(id).disabled = locked;
  });
  document.getElementById('apply-btn').disabled = locked;
}

function setVerifyStatus(type, msg) {
  const el = document.getElementById('verify-status');
  el.className = 'verify-status ' + type;  // pending | running | success | fail
  el.textContent = msg;
}

async function runVerification() {
  if (!selectedEmp) return;

  // Disable the verify button while the camera pipeline runs (takes ~1-2 s).
  const btn = document.getElementById('verify-btn');
  btn.disabled   = true;
  btn.textContent = 'Running…';
  setVerifyStatus('running',
    'Camera is verifying the employee — please stand still in front of the camera…');

  try {
    const res  = await fetch(`/admin/corrections/verify/${encodeURIComponent(selectedEmp.employee_id)}`,
                             { method: 'POST' });
    const data = await res.json();

    if (data.verified) {
      // ── Success: store token, unlock form ──────────────────────────────
      verifyToken  = data.token;
      tokenExpiry  = data.expires_at;

      const simPct = (data.similarity * 100).toFixed(1);
      setVerifyStatus('success',
        `✓ Identity confirmed (similarity ${simPct}%). `
        + `Token valid for 5 minutes. You may now edit the record.`);

      document.getElementById('selected-summary').classList.add('verified');
      document.getElementById('s2-badge').classList.add('done');
      setFormLocked(false);

      // Start countdown timer so admin knows when the token expires.
      startTokenTimer();

    } else {
      // ── Failure: keep form locked ──────────────────────────────────────
      setVerifyStatus('fail',
        `✗ ${data.message || 'Employee verification failed.'}`);
      flash('Verification failed — the form remains locked.', 'err');
    }

  } catch (err) {
    setVerifyStatus('fail', 'Network error during verification.');
    flash('Could not reach the server.', 'err');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Verify Employee';
  }
}

function startTokenTimer() {
  clearInterval(timerInterval);
  function tick() {
    if (!tokenExpiry) return;
    const remaining = Math.max(0, Math.ceil(tokenExpiry - Date.now() / 1000));
    const el = document.getElementById('verify-timer');
    if (remaining === 0) {
      el.textContent = '⚠ Token expired — please re-verify.';
      verifyToken = null;
      setFormLocked(true);
      setVerifyStatus('fail', 'Verification token expired. Click "Verify Employee" again.');
      clearInterval(timerInterval);
    } else {
      const m = String(Math.floor(remaining / 60)).padStart(2,'0');
      const s = String(remaining % 60).padStart(2,'0');
      el.textContent = `Token expires in ${m}:${s}`;
    }
  }
  tick();
  timerInterval = setInterval(tick, 1000);
}

// ── Apply correction ──────────────────────────────────────────────────────────

async function applyCorrection() {
  if (!selectedEmp || !verifyToken) {
    flash('Please verify the employee first.', 'err'); return;
  }

  const ciVal    = document.getElementById('new-ci').value;
  const coVal    = document.getElementById('new-co').value;
  const adminVal = document.getElementById('admin-user').value.trim();

  if (!ciVal && !coVal) {
    flash('Please enter at least one time to update.', 'err'); return;
  }
  if (!adminVal) {
    flash('Please enter your admin name/ID.', 'err'); return;
  }

  const body = {
    token:          verifyToken,
    employee_id:    selectedEmp.employee_id,
    date:           selectedEmp.date,
    check_in_time:  ciVal  || null,
    check_out_time: coVal  || null,
    admin_user:     adminVal,
  };

  const btn = document.getElementById('apply-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    const res  = await fetch('/admin/corrections/apply', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (res.ok) {
      flash(`Correction applied successfully for ${selectedEmp.employee_id} on ${selectedEmp.date}.`, 'ok');
      clearInterval(timerInterval);
      document.getElementById('edit-section').style.display = 'none';
      loadRecords();
    } else {
      flash(data.detail || 'Apply failed.', 'err');
      // Token may have been consumed even on failure — re-verify to be safe.
      verifyToken = null;
      setFormLocked(true);
      setVerifyStatus('fail', 'Token was consumed. Please re-verify the employee.');
    }
  } catch (err) {
    flash('Network error while applying correction.', 'err');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Apply Correction';
  }
}

// ── Audit log ─────────────────────────────────────────────────────────────────

async function loadAuditLog() {
  const res  = await fetch('/admin/corrections');
  const data = await res.json();
  const tbody = document.getElementById('audit-tbody');

  if (!data.corrections.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#9ca3af">'
                    + 'No corrections recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = data.corrections.map(c => {
    const imgCell = c.verification_image_path
      ? `<a href="/${esc(c.verification_image_path)}" target="_blank"
            style="font-size:.75rem;color:#1a56db">view</a>`
      : '—';
    return `<tr>
      <td>${c.id}</td>
      <td>${esc(c.employee_id)}</td>
      <td>${esc(c.record_date)}</td>
      <td>${fmtDateTime(c.original_check_in)}</td>
      <td>${fmtDateTime(c.updated_check_in)}</td>
      <td>${fmtDateTime(c.original_check_out)}</td>
      <td>${fmtDateTime(c.updated_check_out)}</td>
      <td>${esc(c.admin_user)}</td>
      <td style="font-size:.8rem">${fmtDateTime(c.verification_timestamp)}</td>
      <td>${imgCell}</td>
      <td style="font-size:.8rem">${fmtDateTime(c.corrected_at)}</td>
    </tr>`;
  }).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadRecords();
</script>
</body>
</html>"""
        return HTMLResponse(content=html)

    return router
