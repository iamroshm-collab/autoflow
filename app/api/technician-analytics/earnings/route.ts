import { NextRequest, NextResponse } from 'next/server';
import { getTechnicianEarningsSummary } from '@/services/technicianAnalyticsService';

/**
 * GET /api/technician-analytics/earnings
 * Get technician earnings summary
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const earnings = await getTechnicianEarningsSummary(startDate, endDate);

    return NextResponse.json({
      success: true,
      earnings,
    });
  } catch (error: any) {
    console.error('Error fetching earnings summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch earnings summary' },
      { status: 500 }
    );
  }
}
