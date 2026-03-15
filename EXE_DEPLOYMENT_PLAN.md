# EXE Deployment Plan (10 Customer PCs)

## Goal
Ship a stable, error-free Garage app as a Windows `.exe` with no broken DB links, and a repeatable install process for multiple customers.

## Current Health Status
- Production build passes (`npm run build`)
- Prisma schema validates (`npx prisma validate`)
- TypeScript strict check is now enforced via `npm run typecheck`
- Next build now fails on TS errors (safer for production)

## Recommended Architecture (for `.exe`)
Use **Electron + Next.js standalone server + SQLite (Prisma)**:
1. Electron starts local Next server in background.
2. Electron loads the local UI URL in a desktop window.
3. SQLite file is stored in user-writable folder, not install folder.

Why: This is the most practical path from your current Next.js app to a Windows installer without rewriting the app.

## Database Strategy (No Broken Links)
### Rules
- Never keep SQLite DB inside `Program Files`.
- Store DB in: `%LOCALAPPDATA%/GarageApp/data/dev.db` (or similar).
- Set `DATABASE_URL` at runtime to that path.

### Per-customer data isolation
- Each customer PC has its own local DB file.
- Keep backups in `%LOCALAPPDATA%/GarageApp/backups/`.

## Release Pipeline (Every Version)
1. Pull latest source.
2. Run `npm ci`.
3. Run `npm run verify`.
4. Build desktop package (`.exe`).
5. Smoke test installer on clean Windows VM.
6. Distribute installer.

## Install SOP (Each Customer PC)
1. Install the `.exe`.
2. First launch creates local DB and required tables.
3. Import starter data (optional).
4. Verify key workflows:
   - Add customer + vehicle
   - Create job card
   - Inventory purchase + sale
   - Attendance/payroll entry
   - Dashboard loads

## Backup & Recovery SOP
- Auto backup daily on app close/start.
- Keep last 7 backups.
- Add "Restore Backup" admin flow in app.

## Versioning for 10 Customers
- Maintain semantic versions (e.g., `v1.0.0`, `v1.0.1`).
- Keep a customer rollout sheet:
  - Customer name
  - Installed version
  - Install date
  - DB backup status

## Security/Stability Baseline
- Use production Prisma logging level (`warn`, `error`).
- Do not ignore TypeScript build errors.
- Keep `.env` templates only in source; never ship secrets.

## Next Implementation Steps (In Order)
1. Add Electron shell files and process manager for Next standalone.
2. Add runtime DB path resolver (`%LOCALAPPDATA%` based).
3. Add first-run DB bootstrap script (`prisma db push` or migration deploy).
4. Add `electron-builder` config to generate signed Windows installer.
5. Add backup/restore module.
6. Test installer on 2-3 clean machines before all 10.
