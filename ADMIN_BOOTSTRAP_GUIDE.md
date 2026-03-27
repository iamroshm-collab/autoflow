# Admin Bootstrap Guide

This project now includes a secure developer bootstrap flow to create or promote an admin account.

## What Was Added

- API endpoint: /api/auth/bootstrap-admin
- API status endpoint: /api/auth/bootstrap-admin/status
- API lock endpoint: /api/auth/bootstrap-admin/lock
- Developer setup page: /dev/admin-bootstrap
- Environment toggles in .env.example:
  - ADMIN_BOOTSTRAP_ENABLED
  - ADMIN_BOOTSTRAP_ALLOW_IN_PRODUCTION
  - ADMIN_BOOTSTRAP_KEY

## Why This Is Professional

- Admin self-registration remains disabled in normal register flow.
- Bootstrap is locked behind a secret setup key.
- Bootstrap is disabled by default.
- Production usage is blocked unless explicitly and temporarily allowed.
- Uses local database auth only (no Firebase dependency).

## Local Setup (Developer)

1. Copy .env.example to .env.local (if not already done).
2. Set these values:
   - ADMIN_BOOTSTRAP_ENABLED="true"
   - ADMIN_BOOTSTRAP_KEY="your-strong-random-secret"
   - ADMIN_BOOTSTRAP_ALLOW_IN_PRODUCTION="false"
3. Restart the dev server after changing env variables.

## Create Your Test Admin Account

Use the form at /dev/admin-bootstrap:

1. Enter your name.
2. Enter your email (the one you will use to login).
3. Enter password.
4. Enter setup key.
5. Submit.

Result:
- App user is created/updated with role=admin and approvalStatus=approved.

Then login from the normal login page.

## Replace Test Admin With Final Admin Later

Repeat /dev/admin-bootstrap using the final admin email.

After cutover, disable bootstrap:

- ADMIN_BOOTSTRAP_ENABLED="false"
- Keep ADMIN_BOOTSTRAP_ALLOW_IN_PRODUCTION="false"

Optional hardening:

- Remove or block route /dev/admin-bootstrap at reverse proxy level in production.
- Rotate ADMIN_BOOTSTRAP_KEY if it was ever shared.

## One-Click Lock + Verification

After you finish creating admin user:

1. Open /dev/admin-bootstrap
2. Enter setup key
3. Click Lock Bootstrap
4. Click Check Status

Expected status:

- locked: true
- effectiveEnabled: false

You can also verify via API:

- GET /api/auth/bootstrap-admin/status

For permanent deployment safety, still set:

- ADMIN_BOOTSTRAP_ENABLED="false"
