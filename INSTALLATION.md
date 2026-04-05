# Garage App — Installation Guide

Complete step-by-step guide to install and run the app on a new Windows PC from scratch.

---

## What You Are Installing

| Component | Purpose |
|---|---|
| Node.js | Runs the Next.js web application |
| PostgreSQL | Database that stores all app data |
| Python | Runs the face recognition script |
| ffmpeg | Captures frames from the USB camera |
| USB Webcam | Attendance camera plugged into the PC |

---

## Step 1 — Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version (e.g. 20.x)
3. Run the installer, click Next through all steps
4. Open **Command Prompt** and verify:
   ```
   node -v
   npm -v
   ```
   Both should print a version number.

---

## Step 2 — Install PostgreSQL

1. Go to https://www.postgresql.org/download/windows/
2. Click **Download the installer** → download the latest version
3. Run the installer:
   - Set a password for the `postgres` user — **write this down, you will need it**
   - Leave port as **5432**
   - Leave locale as default
4. Finish install. No need to launch Stack Builder.
5. Open **pgAdmin** (installed with PostgreSQL) or use Command Prompt:
   ```
   psql -U postgres
   ```
   Enter the password you set.
6. Create the database:
   ```sql
   CREATE DATABASE "new-garage-app";
   \q
   ```

---

## Step 3 — Install Python

> Python is needed for the face recognition feature.

1. Go to https://www.python.org/downloads/
2. Download **Python 3.11** (do NOT use 3.12 — face_recognition has issues on it)
3. Run the installer:
   - **CHECK the box "Add Python to PATH"** before clicking Install
   - Click Install Now
4. Open Command Prompt and verify:
   ```
   python --version
   ```
   Should print `Python 3.11.x`

5. Install face recognition packages:
   ```
   pip install face_recognition Pillow requests numpy
   ```
   > This will take 5–10 minutes. If it fails with a CMake or dlib error, follow the extra step below.

### If face_recognition install fails (dlib error)

Install these first, then retry:

1. Install **CMake**: https://cmake.org/download/ → Windows x64 Installer → check "Add CMake to PATH"
2. Install **Visual Studio Build Tools**: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - In the installer, select **"Desktop development with C++"**
   - Click Install
3. Retry:
   ```
   pip install face_recognition Pillow requests numpy
   ```

---

## Step 4 — Install ffmpeg

> ffmpeg is needed to activate the USB camera and capture a photo frame.

1. Go to https://www.gyan.dev/ffmpeg/builds/
2. Download **ffmpeg-release-essentials.zip** (under "release builds")
3. Extract the zip — you will get a folder like `ffmpeg-7.x-essentials_build`
4. Rename that folder to `ffmpeg` and move it to `C:\ffmpeg\`
5. Add ffmpeg to PATH:
   - Press **Windows key**, search **"Environment Variables"**, open it
   - Under **System Variables**, find `Path`, click Edit
   - Click New → type `C:\ffmpeg\bin` → click OK on all windows
6. Open a **new** Command Prompt and verify:
   ```
   ffmpeg -version
   ```
   Should print ffmpeg version info.

---

## Step 5 — Connect the USB Camera

1. Plug the USB webcam into the PC
2. Wait for Windows to install the driver (30–60 seconds)
3. Find the exact device name:
   ```
   ffmpeg -list_devices true -f dshow -i dummy
   ```
   Look for output like:
   ```
   [dshow] DirectShow video devices
   [dshow]  "USB2.0 Camera"
   ```
4. Copy the name exactly as shown (e.g. `USB2.0 Camera`) — you will use it in Step 7.

---

## Step 6 — Copy and Set Up the App

1. Copy the app folder to the PC, e.g. to `C:\garage-app\`
2. Open Command Prompt inside that folder:
   ```
   cd C:\garage-app
   ```
3. Install app dependencies:
   ```
   npm install
   ```

---

## Step 7 — Configure Environment Variables

1. In the app folder, find the file `.env.example`
2. Make a copy of it and name it `.env` (in the same folder)
3. Open `.env` in Notepad and fill in the values:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/new-garage-app"
# Replace YOUR_POSTGRES_PASSWORD with the password you set in Step 2

# ── App ───────────────────────────────────────────────────────────────────────
APP_BASE_URL="http://localhost:3000"
# If running on a local network and phones access via IP, use:
# APP_BASE_URL="http://192.168.1.XX:3000"   ← replace with this PC's local IP

# ── Admin Login ───────────────────────────────────────────────────────────────
ADMIN_MOBILE="9876543210"
# The mobile number that can log in as admin via WhatsApp OTP

# ── WhatsApp OTP (for admin login) ────────────────────────────────────────────
META_WHATSAPP_ACCESS_TOKEN="your_token_here"
META_WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="your_business_account_id"
META_WHATSAPP_API_VERSION="v20.0"
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN="your_webhook_verify_token"
META_WHATSAPP_OTP_TEMPLATE_NAME="verification_code"
WHATSAPP_OTP_TTL_MINUTES="5"

# ── USB Camera (attendance) ────────────────────────────────────────────────────
USB_CAMERA_DEVICE="USB2.0 Camera"
# Paste the exact device name you found in Step 5

USB_CAMERA_INDEX="0"
# Usually 0. Change to 1 or 2 if the wrong camera is being used.

# ── Face Recognition ──────────────────────────────────────────────────────────
PYTHON_BIN="python"
# If python is not in PATH, use the full path e.g.:
# PYTHON_BIN="C:/Users/YourName/AppData/Local/Programs/Python/Python311/python.exe"

FACE_RECOGNITION_THRESHOLD="0.55"
# Lower = stricter matching. 0.55 is a good default.
# Tighten to 0.50 if false positives occur.

FACE_RECOGNITION_TIMEOUT_MS="15000"
# Max time in ms to wait for face recognition. Increase on slow PCs.

# ── Shop Settings ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_SHOP_CODE="AL"
# Short code for this garage location
```

---

## Step 8 — Set Up the Database

Run these commands inside the app folder:

```
npx prisma generate
npx prisma db push
```

This creates all the tables in the PostgreSQL database.

> If you see an error about the database not existing, make sure you completed Step 2 (created the database in pgAdmin).

---

## Step 9 — Build and Start the App

```
npm run build
npm start
```

The app will start on port 3000.

To access it:
- On this PC: http://localhost:3000
- From phones on the same Wi-Fi: http://192.168.1.XX:3000 (replace XX with this PC's local IP)

### Find this PC's local IP

Open Command Prompt:
```
ipconfig
```
Look for **IPv4 Address** under your network adapter, e.g. `192.168.1.45`

---

## Step 10 — First-Time App Setup (Admin)

1. Open http://localhost:3000 in a browser
2. Go to the admin login page
3. Log in with the ADMIN_MOBILE number — you will receive a WhatsApp OTP
4. Go to **Settings → Shop Settings**:
   - Fill in shop name, address, GSTIN etc.
   - Set the **Garage Latitude and Longitude** (used for geo-fencing if needed)
5. Go to **Employees** → add each employee with:
   - Name, mobile number, designation
   - Upload a clear **face photo** (used for attendance verification)
6. Go to **Approvals** → approve each employee's device when they first log in from their phone

---

## Step 11 — Employee Phone Setup

Each employee:
1. Opens the browser on their phone
2. Goes to `http://192.168.1.XX:3000` (the PC's local IP)
3. Registers with their mobile number
4. On first login, their device is sent for approval
5. Admin approves the device in the Approvals page
6. Employee can now mark attendance by tapping **Mark IN / Mark OUT**

---

## Running the App on Windows Startup (Optional)

To auto-start the app when the PC boots:

1. Install PM2:
   ```
   npm install -g pm2
   npm install -g pm2-windows-startup
   ```
2. Start the app with PM2:
   ```
   cd C:\garage-app
   pm2 start npm --name "garage-app" -- start
   pm2-startup install
   pm2 save
   ```

The app will now start automatically every time the PC restarts.

---

## Troubleshooting

### Camera not working
- Make sure the USB camera is plugged in before starting the app
- Run `ffmpeg -list_devices true -f dshow -i dummy` and confirm the device name matches `USB_CAMERA_DEVICE` in `.env`
- Try setting `USB_CAMERA_INDEX="1"` if multiple cameras are connected

### Face recognition failing for everyone
- Check that `PYTHON_BIN` points to a working Python 3.11 installation
- Run `python -c "import face_recognition; print('OK')"` to confirm the package is installed
- Check that the employee has a clear, well-lit face photo uploaded in the app

### Face recognition too strict / too lenient
- Adjust `FACE_RECOGNITION_THRESHOLD` in `.env`:
  - `0.50` — stricter (fewer false positives, may reject valid employees in bad lighting)
  - `0.55` — balanced (recommended default)
  - `0.60` — lenient (easier to match, higher risk of false positives)

### Database connection error
- Confirm PostgreSQL is running: open **Services** in Windows, find **postgresql-x64-XX**, make sure it is Running
- Confirm the password in `DATABASE_URL` matches what you set during PostgreSQL install

### Port 3000 already in use
- Change the port: `npm start -- -p 3001`
- Or find and kill the process using port 3000:
  ```
  netstat -ano | findstr :3000
  taskkill /PID <PID_NUMBER> /F
  ```

### Employees can't reach the app from their phones
- Make sure the PC and phones are on the same Wi-Fi network
- Disable Windows Firewall for port 3000, or add an inbound rule:
  - Open **Windows Defender Firewall → Advanced Settings**
  - New Inbound Rule → Port → TCP → 3000 → Allow

---

## Summary Checklist

- [ ] Node.js installed
- [ ] PostgreSQL installed, database `new-garage-app` created
- [ ] Python 3.11 installed, `face_recognition` package installed
- [ ] ffmpeg installed, added to PATH
- [ ] USB camera plugged in, device name found
- [ ] App folder copied to PC, `npm install` done
- [ ] `.env` file created and filled in
- [ ] `npx prisma db push` done
- [ ] `npm run build && npm start` done
- [ ] Admin logged in and shop settings configured
- [ ] Employees added with face photos
- [ ] Employee devices approved
