# Technician Job Allocation System - Implementation Guide

## Overview

This system enables **technician job allocation** and **performance tracking** for your garage management application. It includes:

- **Admin Dashboard**: Assign jobs to technicians, track performance, and view analytics
- **Mobile Web Interface**: Technicians can view, accept, start, and complete jobs from their phones
- **Push Notifications**: Firebase Cloud Messaging notifies technicians when jobs are assigned
- **Tailscale VPN**: Secure remote access to the office server from anywhere

---

## System Architecture

### Components

1. **Backend**: Node.js with Next.js API Routes
2. **Database**: PostgreSQL with Prisma ORM
3. **Notifications**: Firebase Cloud Messaging (FCM)
4. **Network**: Tailscale VPN for secure remote access
5. **Mobile Interface**: Progressive Web App (PWA) accessible via browser

### Tech Stack

- **Framework**: Next.js 14+ with App Router
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Push Notifications**: Firebase Admin SDK
- **Authentication**: (Add your existing auth system)

---

## Database Schema

### New Tables Created

#### 1. Technicians
```sql
- id: String (Primary Key)
- name: String
- phone: String (Unique)
- is_active: Boolean
- created_at: DateTime
- updated_at: DateTime
```

#### 2. TechnicianAllocations
```sql
- id: String (Primary Key)
- job_id: String (FK → JobCard)
- technician_id: String (FK → Technician)
- assigned_at: DateTime
- accepted_at: DateTime?
- started_at: DateTime?
- completed_at: DateTime?
- job_duration: Int? (minutes)
- earning_amount: Float
- status: String (assigned|accepted|in_progress|completed)
- created_at: DateTime
- updated_at: DateTime
```

#### 3. DeviceTokens
```sql
- id: String (Primary Key)
- technician_id: String (FK → Technician)
- token: String (Unique)
- created_at: DateTime
```

### Database Migration

After updating the schema, run:

```bash
npx prisma migrate dev --name add_technician_allocation_system
npx prisma generate
```

---

## Environment Setup

### Required Environment Variables

Create or update your `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/garage_db"

# Firebase Admin SDK
# Store your Firebase service account JSON as a string
FIREBASE_SERVICE_ACCOUNT_KEY='{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "...",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}'

# Server URL (for notifications and links)
# Use your Tailscale IP in production
NEXT_PUBLIC_SERVER_URL="http://100.xx.xx.xx:3000"
```

---

## Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable **Cloud Messaging**

### Step 2: Generate Service Account Key

1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Download the JSON file
4. Copy the entire JSON content to `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

### Step 3: Get Firebase Config for Web

1. Go to **Project Settings** → **General**
2. Scroll to **Your apps** section
3. Click **Web** icon to add a web app
4. Copy the Firebase config object (you'll need this for the client-side notification registration)

---

## API Endpoints

### Technician Management

#### List All Technicians
```http
GET /api/technicians
Query Parameters:
  - isActive: boolean (optional)
```

#### Create Technician
```http
POST /api/technicians
Body: {
  "name": "John Doe",
  "phone": "+919876543210",
  "isActive": true
}
```

#### Get Technician Details
```http
GET /api/technicians/[id]
```

#### Update Technician
```http
PATCH /api/technicians/[id]
Body: {
  "name": "Updated Name",
  "phone": "+919876543210",
  "isActive": false
}
```

#### Get Technician's Jobs
```http
GET /api/technicians/[id]/jobs
Query Parameters:
  - status: string (optional) - Filter by status
  - pending: boolean (optional) - Get only pending jobs
```

---

### Job Allocation

#### Assign Technicians to Job
```http
POST /api/technician-jobs/assign
Body: {
  "jobId": "clx123...",
  "technicianIds": ["tech1", "tech2"],
  "earningAmount": 500
}
```

#### Get Job Allocations
```http
GET /api/technician-jobs/assign?jobId=clx123...
```

#### Accept Job
```http
POST /api/technician-jobs/[allocationId]/accept
```

#### Start Job
```http
POST /api/technician-jobs/[allocationId]/start
```

#### Complete Job
```http
POST /api/technician-jobs/[allocationId]/complete
Body: {
  "earningAmount": 600  // Optional, can update earning amount
}
```

#### Get Allocation Details
```http
GET /api/technician-jobs/[allocationId]
```

---

### Notifications

#### Save Device Token
```http
POST /api/notifications/device-token
Body: {
  "technicianId": "tech1",
  "token": "fcm_device_token_here"
}
```

---

### Analytics & Reporting

#### Dashboard Statistics
```http
GET /api/technician-analytics/dashboard

Response: {
  "today": {
    "totalJobs": 15,
    "activeJobs": 8,
    "completedJobs": 7
  },
  "thisWeek": {
    "totalJobs": 87,
    "completedJobs": 65
  },
  "thisMonth": {
    "totalJobs": 320,
    "completedJobs": 285,
    "totalEarnings": 145000
  }
}
```

#### Performance Metrics
```http
GET /api/technician-analytics/performance
Query Parameters:
  - technicianId: string (optional)
  - startDate: ISO date (optional)
  - endDate: ISO date (optional)

Response: [
  {
    "technicianId": "tech1",
    "technicianName": "John Doe",
    "totalJobsCompleted": 45,
    "averageCompletionTime": 120,  // minutes
    "totalEarnings": 22500,
    "activeJobs": 3
  }
]
```

#### Job Statistics
```http
GET /api/technician-analytics/job-stats
Query Parameters:
  - startDate: ISO date (optional)
  - endDate: ISO date (optional)

Response: {
  "totalJobs": 150,
  "assignedJobs": 10,
  "acceptedJobs": 5,
  "inProgressJobs": 8,
  "completedJobs": 127
}
```

#### Earnings Summary
```http
GET /api/technician-analytics/earnings
Query Parameters:
  - startDate: ISO date (optional)
  - endDate: ISO date (optional)

Response: [
  {
    "technicianId": "tech1",
    "technicianName": "John Doe",
    "totalJobs": 45,
    "totalEarnings": 22500
  }
]
```

#### Job Completion Trend
```http
GET /api/technician-analytics/trend
Query Parameters:
  - days: number (default: 7)

Response: [
  { "date": "2026-03-10", "count": 12 },
  { "date": "2026-03-09", "count": 15 },
  ...
]
```

---

## Workflow

### Admin Workflow

1. **Create Job Card**: Admin creates a new job card in the system
2. **Assign Technicians**: Admin goes to the job and assigns one or multiple technicians
   - System creates `TechnicianAllocation` records with status `"assigned"`
   - `assigned_at` timestamp is recorded
   - Push notifications are sent automatically to assigned technicians
3. **Track Progress**: Admin can monitor job status in real-time
4. **View Performance**: Admin can view technician performance metrics and analytics

### Technician Workflow

1. **Receive Notification**: Technician receives push notification when job is assigned
2. **Open Job**: Clicking notification opens the job details page
3. **Accept Job**: Technician clicks "Accept Job" button
   - Status changes to `"accepted"`
   - `accepted_at` timestamp is recorded
4. **Start Work**: When technician begins work, they click "Start Work"
   - Status changes to `"in_progress"`
   - `started_at` timestamp is recorded
5. **Complete Job**: After finishing work, technician clicks "Complete Job"
   - Status changes to `"completed"`
   - `completed_at` timestamp is recorded
   - `job_duration` is automatically calculated (completed_at - started_at)

---

## Tailscale Setup

### Why Tailscale?

Tailscale creates a secure VPN network that allows technicians to access the office server from anywhere using mobile data, without complex port forwarding or exposing the server to the internet.

### Setup Steps

#### 1. Install Tailscale on Office PC (Server)

**Windows:**
```powershell
# Download from https://tailscale.com/download/windows
# Or use winget:
winget install tailscale.tailscale
```

**After Installation:**
1. Open Tailscale
2. Click "Log in"
3. Sign in with your account
4. Your server will get an IP like `100.xx.xx.xx`

#### 2. Install Tailscale on Technician Phones

**Android/iOS:**
1. Download Tailscale app from Play Store / App Store
2. Open app and log in with same account
3. Each phone gets its own Tailscale IP

#### 3. Configure Server

Find your server's Tailscale IP:
```powershell
# Windows
tailscale ip -4

# Example output: 100.87.123.45
```

Update `.env.local`:
```bash
NEXT_PUBLIC_SERVER_URL="http://100.87.123.45:3000"
```

#### 4. Test Connection

From technician phone:
1. Connect to Tailscale VPN
2. Open browser
3. Navigate to `http://100.87.123.45:3000`
4. You should see the application

---

## Push Notifications Implementation

### Client-Side (Technician Mobile Interface)

Create a notification registration component:

```typescript
// components/NotificationRegistration.tsx
'use client';

import { useEffect, useState } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

// Your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);

export function NotificationRegistration({ technicianId }: { technicianId: string }) {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: 'YOUR_VAPID_KEY' // Get from Firebase Console
        });

        // Save token to backend
        await fetch('/api/notifications/device-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technicianId,
            token
          })
        });

        console.log('Device token saved:', token);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  if (permission === 'granted') {
    return <p>Notifications enabled ✓</p>;
  }

  return (
    <button onClick={requestPermission}>
      Enable Notifications
    </button>
  );
}
```

### Service Worker for Background Notifications

Create `public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data.url;
  if (url) {
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});
```

---

## SQL Analytics Queries

See `database/technician_analytics_queries.sql` for comprehensive SQL queries including:

- Average completion time per technician
- Total jobs completed
- Total earnings
- Daily/weekly/monthly stats
- Response time analysis
- Job distribution across technicians
- And many more...

---

## Admin Dashboard Example

### Dashboard Page
Create `app/admin/technician-dashboard/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function TechnicianDashboard() {
  const [stats, setStats] = useState(null);
  const [performance, setPerformance] = useState([]);

  useEffect(() => {
    // Fetch dashboard stats
    fetch('/api/technician-analytics/dashboard')
      .then(res => res.json())
      .then(data => setStats(data.stats));

    // Fetch technician performance
    fetch('/api/technician-analytics/performance')
      .then(res => res.json())
      .then(data => setPerformance(data.performance));
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Technician Dashboard</h1>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Total Jobs Today</h3>
          <p className="text-3xl font-bold">{stats.today.totalJobs}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Active Jobs</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.today.activeJobs}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Completed Today</h3>
          <p className="text-3xl font-bold text-green-600">{stats.today.completedJobs}</p>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Technician Performance</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Name</th>
              <th className="text-right p-2">Completed</th>
              <th className="text-right p-2">Avg Time</th>
              <th className="text-right p-2">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {performance.map((tech) => (
              <tr key={tech.technicianId} className="border-b">
                <td className="p-2">{tech.technicianName}</td>
                <td className="text-right p-2">{tech.totalJobsCompleted}</td>
                <td className="text-right p-2">{tech.averageCompletionTime} min</td>
                <td className="text-right p-2">₹{tech.totalEarnings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Testing

### 1. Test Database Migration
```bash
npx prisma migrate dev
npx prisma studio  # Open Prisma Studio to verify tables
```

### 2. Test API Endpoints

Create a test technician:
```bash
curl -X POST http://localhost:3000/api/technicians \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Tech","phone":"+919876543210"}'
```

Assign technician to job:
```bash
curl -X POST http://localhost:3000/api/technician-jobs/assign \
  -H "Content-Type: application/json" \
  -d '{"jobId":"your_job_id","technicianIds":["tech_id"],"earningAmount":500}'
```

### 3. Test Notifications

1. Open technician mobile interface
2. Enable notifications
3. Verify device token is saved in database
4. Assign a job and check if notification is received

---

## Production Deployment

### 1. Database Migration
```bash
npx prisma migrate deploy
```

### 2. Environment Variables

Ensure all environment variables are set in production:
- `DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `NEXT_PUBLIC_SERVER_URL` (with Tailscale IP)

### 3. Start Server
```bash
npm run build
npm start
```

### 4. Configure Firewall

Allow port 3000 (or your chosen port) for Tailscale connections:
```powershell
# Windows Firewall
netsh advfirewall firewall add rule name="Next.js Server" dir=in action=allow protocol=TCP localport=3000
```

---

## Troubleshooting

### Issue: Notifications not received

**Solutions:**
1. Check Firebase service account key is correctly set
2. Verify device token is saved in database
3. Check browser console for FCM errors
4. Ensure notification permission is granted

### Issue: Cannot access server from mobile

**Solutions:**
1. Verify Tailscale is connected on both server and mobile
2. Check server is running: `curl http://localhost:3000`
3. Verify Tailscale IP: `tailscale ip -4`
4. Test from another device on Tailscale network

### Issue: Database connection errors

**Solutions:**
1. Verify PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Run `npx prisma generate`
4. Check database logs

---

## Support

For issues or questions:
1. Check the logs in the terminal
2. Review the Prisma schema
3. Verify all environment variables are set
4. Test API endpoints with Postman or curl

---

## Next Steps

1. **UI Development**: Create admin dashboard pages and technician mobile interface
2. **Authentication**: Integrate with your existing authentication system
3. **Real-time Updates**: Consider adding WebSockets for real-time job status updates
4. **Reporting**: Build comprehensive reporting pages using the analytics APIs
5. **Mobile App**: Optionally convert to a native mobile app using React Native

---

## File Structure

```
project/
├── prisma/
│   └── schema.prisma (Updated with new models)
├── services/
│   ├── jobAllocationService.ts
│   ├── firebaseNotificationService.ts
│   └── technicianAnalyticsService.ts
├── app/
│   └── api/
│       ├── technicians/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── jobs/route.ts
│       ├── technician-jobs/
│       │   ├── assign/route.ts
│       │   └── [allocationId]/
│       │       ├── route.ts
│       │       ├── accept/route.ts
│       │       ├── start/route.ts
│       │       └── complete/route.ts
│       ├── notifications/
│       │   └── device-token/route.ts
│       └── technician-analytics/
│           ├── dashboard/route.ts
│           ├── performance/route.ts
│           ├── job-stats/route.ts
│           ├── earnings/route.ts
│           └── trend/route.ts
├── database/
│   └── technician_analytics_queries.sql
└── public/
    └── firebase-messaging-sw.js
```
