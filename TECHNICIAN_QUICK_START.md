# Technician System - Quick Setup

## Installation

### 1. Install Firebase Admin SDK

```bash
npm install firebase-admin
```

### 2. Install Firebase Client SDK (for mobile notifications)

```bash
npm install firebase
```

### 3. Database Migration

Run Prisma migration to create the new tables:

```bash
# Generate Prisma Client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_technician_allocation_system

# Or for production
npx prisma migrate deploy
```

### 4. Verify Tables Created

Open Prisma Studio to verify tables:

```bash
npx prisma studio
```

Check that these tables exist:
- Technicians
- TechnicianAllocations  
- DeviceTokens

## Firebase Setup

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Follow the wizard to create project

### 2. Enable Cloud Messaging

1. In Firebase Console, click on gear icon → Project Settings
2. Click on "Cloud Messaging" tab
3. Enable Cloud Messaging API

### 3. Get Service Account Key

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file
4. Copy the entire JSON content to `.env` as `FIREBASE_SERVICE_ACCOUNT_KEY`

### 4. Get Web App Config

1. Go to Project Settings → General
2. Scroll to "Your apps"
3. Click Web icon (</>) to add a web app
4. Register app and copy the config
5. Get VAPID key from Cloud Messaging settings

## Configuration

### 1. Create .env file

Copy `.env.technician.example` to `.env` and fill in the values:

```bash
cp .env.technician.example .env
```

### 2. Update Database URL

Edit `DATABASE_URL` in `.env` with your PostgreSQL credentials

### 3. Add Firebase Config

Paste your Firebase service account JSON into `FIREBASE_SERVICE_ACCOUNT_KEY`

### 4. Set Server URL

For local development:
```
NEXT_PUBLIC_SERVER_URL="http://localhost:3000"
```

For production with Tailscale:
```
NEXT_PUBLIC_SERVER_URL="http://100.xx.xx.xx:3000"
```

## Testing

### 1. Create Test Technician

```bash
curl -X POST http://localhost:3000/api/technicians \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Technician",
    "phone": "+919876543210",
    "isActive": true
  }'
```

### 2. List Technicians

```bash
curl http://localhost:3000/api/technicians
```

### 3. Assign Job to Technician

```bash
curl -X POST http://localhost:3000/api/technician-jobs/assign \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "YOUR_JOB_ID",
    "technicianIds": ["TECHNICIAN_ID"],
    "earningAmount": 500
  }'
```

## Tailscale Setup (Optional but Recommended)

### 1. Install Tailscale on Server

**Windows:**
```powershell
winget install tailscale.tailscale
```

**Linux:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### 2. Login and Get IP

```bash
tailscale up
tailscale ip -4
```

Note the IP (e.g., `100.87.123.45`)

### 3. Update Environment Variable

```
NEXT_PUBLIC_SERVER_URL="http://100.87.123.45:3000"
```

### 4. Install on Mobile Devices

- Android: https://play.google.com/store/apps/details?id=com.tailscale.ipn
- iOS: https://apps.apple.com/app/tailscale/id1470499037

Log in with same account to join the network

## Running the Application

### Development

```bash
npm run dev
```

Access at: http://localhost:3000

### Production

```bash
npm run build
npm start
```

## Verify Installation

✓ Database tables created (check with Prisma Studio)
✓ API endpoints responding
✓ Firebase Admin SDK initialized (check console logs)
✓ Tailscale network configured (if using)

## Next Steps

1. **Create Admin UI**: Build pages for job assignment and performance tracking
2. **Create Technician Mobile UI**: Build mobile-friendly pages for technicians
3. **Implement Notifications**: Add notification registration in technician UI
4. **Add Authentication**: Integrate with your auth system
5. **Test Workflow**: Test complete job assignment workflow

## Troubleshooting

### Prisma Migration Failed

```bash
# Reset database (WARNING: deletes data)
npx prisma migrate reset

# Then re-run migration
npx prisma migrate dev
```

### Firebase Admin Not Initialized

Check that `FIREBASE_SERVICE_ACCOUNT_KEY` is properly formatted JSON (single line, properly escaped)

### Cannot Access via Tailscale

- Verify Tailscale is running on both server and mobile
- Check firewall allows port 3000
- Verify `NEXT_PUBLIC_SERVER_URL` uses correct Tailscale IP

## Documentation

See `TECHNICIAN_SYSTEM_GUIDE.md` for comprehensive documentation including:
- Complete API reference
- Workflow explanations
- Advanced configuration
- SQL analytics queries
- Frontend implementation examples

## Support Files Created

- `prisma/schema.prisma` - Updated with new models
- `services/jobAllocationService.ts` - Job allocation logic
- `services/firebaseNotificationService.ts` - Push notifications
- `services/technicianAnalyticsService.ts` - Analytics and reporting
- `app/api/technicians/*` - Technician management APIs
- `app/api/technician-jobs/*` - Job workflow APIs
- `app/api/technician-analytics/*` - Analytics APIs
- `app/api/notifications/*` - Device token management
- `database/technician_analytics_queries.sql` - SQL queries for analytics
- `TECHNICIAN_SYSTEM_GUIDE.md` - Complete implementation guide
- `.env.technician.example` - Environment variables template
