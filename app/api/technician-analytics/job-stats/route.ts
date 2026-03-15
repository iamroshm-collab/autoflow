import { NextRequest, NextResponse } from 'next/server';
import { getJobStatistics } from '@/services/technicianAnalyticsService';

/**
 * GET /api/technician-analytics/job-stats
 * Get job statistics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const stats = await getJobStatistics(startDate, endDate);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching job statistics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job statistics' },
      { status: 500 }
    );
  }
}
