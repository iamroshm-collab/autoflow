import { NextRequest, NextResponse } from 'next/server';
import { saveNotificationDevice } from '@/services/notificationService';

/**
 * POST /api/notifications/device-token
 * Save device token for push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const employeeId = Number(body?.employeeId ?? body?.technicianId);
    const oneSignalPlayerId = String(body?.oneSignalPlayerId ?? body?.token ?? '').trim();

    if (!Number.isInteger(employeeId) || !oneSignalPlayerId) {
      return NextResponse.json(
        { error: 'employeeId and oneSignalPlayerId are required' },
        { status: 400 }
      );
    }

    const deviceToken = await saveNotificationDevice(employeeId, oneSignalPlayerId);

    return NextResponse.json({
      success: true,
      message: 'OneSignal device saved successfully',
      deviceToken,
    });
  } catch (error: any) {
    console.error('Error saving device token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save device token' },
      { status: 500 }
    );
  }
}
