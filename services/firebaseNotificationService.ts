import admin from 'firebase-admin';
import { prisma } from '@/lib/prisma';
import { existsSync, readFileSync } from 'fs';

// Initialize Firebase Admin SDK
// Make sure to set FIREBASE_SERVICE_ACCOUNT_KEY environment variable
// with the path to your Firebase service account JSON file
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccount) {
      let serviceAccountJson: Record<string, any> | null = null;
      const raw = serviceAccount.trim();

      try {
        serviceAccountJson = JSON.parse(raw);
      } catch {
        if (existsSync(raw)) {
          serviceAccountJson = JSON.parse(readFileSync(raw, 'utf8'));
        }
      }

      if (!serviceAccountJson) {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT_KEY must be a JSON string or a valid file path'
        );
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountJson),
      });
      console.log('Firebase Admin initialized successfully');
    } else {
      console.warn('Firebase Admin not initialized: FIREBASE_SERVICE_ACCOUNT_KEY not set');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface JobAssignmentNotification {
  jobId: string;
  vehicleNumber: string;
  taskAssigned?: string;
  customerName?: string;
}

export interface JobStatusChangeNotification {
  jobId: string;
  vehicleNumber?: string;
  customerName?: string;
}

/**
 * Save device token for a technician
 */
export async function saveDeviceToken(
  technicianId: string | number,
  token: string,
  deviceType = 'web'
) {
  const employeeId = Number(technicianId);
  if (!Number.isInteger(employeeId)) {
    throw new Error('Invalid technicianId');
  }

  try {
    const technician = await prisma.employee.findFirst({
      where: {
        employeeId,
        isTechnician: true,
        isArchived: false,
      },
      select: { employeeId: true },
    });

    if (!technician) {
      throw new Error('Technician not found or inactive');
    }

    // Check if token already exists
    const existingToken = await prisma.deviceToken.findUnique({
      where: { token },
    });

    if (existingToken) {
      // Update if token exists for different technician
      if (existingToken.employeeId !== employeeId || existingToken.deviceType !== deviceType) {
        return await prisma.deviceToken.update({
          where: { token },
          data: { employeeId, deviceType },
        });
      }
      return existingToken;
    }

    // Create new token
    return await prisma.deviceToken.create({
      data: {
        employeeId,
        token,
        deviceType,
      },
    });
  } catch (error) {
    console.error('Error saving device token:', error);
    throw new Error('Failed to save device token');
  }
}

/**
 * Get all device tokens for a technician
 */
export async function getTechnicianTokens(technicianId: string | number) {
  const employeeId = Number(technicianId);
  if (!Number.isInteger(employeeId)) {
    return [];
  }

  return await prisma.deviceToken.findMany({
    where: { employeeId },
  });
}

/**
 * Delete a device token
 */
export async function deleteDeviceToken(token: string) {
  try {
    await prisma.deviceToken.delete({
      where: { token },
    });
  } catch (error) {
    console.error('Error deleting device token:', error);
  }
}

/**
 * Send push notification to a specific device token
 */
export async function sendNotification(
  token: string,
  payload: NotificationPayload
) {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized. Skipping notification.');
    return null;
  }

  try {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      token,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return response;
  } catch (error: any) {
    console.error('Error sending notification:', error);
    
    // If token is invalid, delete it from database
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.log('Deleting invalid token:', token);
      await deleteDeviceToken(token);
    }
    
    throw error;
  }
}

/**
 * Send notification to multiple device tokens
 */
export async function sendMulticastNotification(
  tokens: string[],
  payload: NotificationPayload
) {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized. Skipping notification.');
    return null;
  }

  if (tokens.length === 0) {
    console.warn('No tokens provided for multicast notification');
    return null;
  }

  try {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications`);
    
    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error('Error sending to token:', tokens[idx], resp.error);
          
          // Delete invalid tokens
          if (
            resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      // Delete all invalid tokens
      await Promise.all(
        failedTokens.map((token) => deleteDeviceToken(token))
      );
    }
    
    return response;
  } catch (error) {
    console.error('Error sending multicast notification:', error);
    throw error;
  }
}

/**
 * Send job assignment notification to a technician
 */
export async function sendJobAssignmentNotification(
  technicianId: string | number,
  jobDetails: JobAssignmentNotification,
  serverUrl: string
) {
  try {
    // Get all device tokens for the technician
    const deviceTokens = await getTechnicianTokens(technicianId);
    
    if (deviceTokens.length === 0) {
      console.warn(`No device tokens found for technician: ${technicianId}`);
      return null;
    }

    const tokens = deviceTokens.map((dt) => dt.token);
    
    const payload: NotificationPayload = {
      title: 'New Job Assigned',
      body: `Vehicle: ${jobDetails.vehicleNumber}${
        jobDetails.taskAssigned ? ` | Task: ${jobDetails.taskAssigned}` : ''
      }`,
      data: {
        jobId: jobDetails.jobId,
        vehicleNumber: jobDetails.vehicleNumber,
        taskAssigned: jobDetails.taskAssigned || '',
        type: 'job_assignment',
        url: `${serverUrl}/technician`,
      },
    };

    return await sendMulticastNotification(tokens, payload);
  } catch (error) {
    console.error('Error sending job assignment notification:', error);
    throw error;
  }
}

/**
 * Send job assignment notifications to multiple technicians
 */
export async function sendJobAssignmentNotifications(
  technicianIds: Array<string | number>,
  jobDetails: JobAssignmentNotification,
  serverUrl: string
) {
  const results = await Promise.allSettled(
    technicianIds.map((technicianId) =>
      sendJobAssignmentNotification(technicianId, jobDetails, serverUrl)
    )
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(
    `Job assignment notifications sent: ${successful} successful, ${failed} failed`
  );

  return { successful, failed, results };
}

/**
 * Send generic notification to a technician
 */
export async function sendTechnicianNotification(
  technicianId: string | number,
  payload: NotificationPayload
) {
  try {
    const deviceTokens = await getTechnicianTokens(technicianId);
    
    if (deviceTokens.length === 0) {
      console.warn(`No device tokens found for technician: ${technicianId}`);
      return null;
    }

    const tokens = deviceTokens.map((dt) => dt.token);
    return await sendMulticastNotification(tokens, payload);
  } catch (error) {
    console.error('Error sending technician notification:', error);
    throw error;
  }
}

export async function sendJobReassignedNotifications(
  technicianIds: Array<string | number>,
  jobDetails: JobStatusChangeNotification,
  serverUrl: string
) {
  const payload: NotificationPayload = {
    title: 'Job Reassigned',
    body: `Vehicle: ${jobDetails.vehicleNumber || 'Unknown'}`,
    data: {
      jobId: jobDetails.jobId,
      vehicleNumber: jobDetails.vehicleNumber || '',
      type: 'job_reassigned',
      url: `${serverUrl}/technician`,
    },
  };

  const results = await Promise.allSettled(
    technicianIds.map((technicianId) => sendTechnicianNotification(technicianId, payload))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(
    `Job reassignment notifications sent: ${successful} successful, ${failed} failed`
  );

  return { successful, failed, results };
}

export async function sendJobDeletedNotifications(
  technicianIds: Array<string | number>,
  jobDetails: JobStatusChangeNotification,
  serverUrl: string
) {
  const payload: NotificationPayload = {
    title: 'Job Cancelled',
    body: `Vehicle: ${jobDetails.vehicleNumber || 'Unknown'}`,
    data: {
      jobId: jobDetails.jobId,
      vehicleNumber: jobDetails.vehicleNumber || '',
      type: 'job_deleted',
      url: `${serverUrl}/technician`,
    },
  };

  const results = await Promise.allSettled(
    technicianIds.map((technicianId) => sendTechnicianNotification(technicianId, payload))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(
    `Job deletion notifications sent: ${successful} successful, ${failed} failed`
  );

  return { successful, failed, results };
}
