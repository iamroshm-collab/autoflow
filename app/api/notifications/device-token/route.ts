import { NextRequest, NextResponse } from 'next/server';
import { saveDeviceToken } from '@/services/firebaseNotificationService';

/**
 * POST /api/notifications/device-token
 * Save device token for push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { technicianId, token, deviceType } = body;
    const parsedTechnicianId = Number(technicianId);

    if (!Number.isInteger(parsedTechnicianId) || !token) {
      return NextResponse.json(
        { error: 'technicianId (employeeId) and token are required' },
        { status: 400 }
      );
    }

    const deviceToken = await saveDeviceToken(
      String(parsedTechnicianId),
      token,
      typeof deviceType === 'string' && deviceType.trim() ? deviceType.trim() : 'web'
    );

    return NextResponse.json({
      success: true,
      message: 'Device token saved successfully',
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
