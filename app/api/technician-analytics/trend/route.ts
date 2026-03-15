import { NextRequest, NextResponse } from 'next/server';
import { getJobCompletionTrend } from '@/services/technicianAnalyticsService';

/**
 * GET /api/technician-analytics/trend
 * Get job completion trend data for charts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysStr = searchParams.get('days');
    const days = daysStr ? parseInt(daysStr) : 7;

    const trend = await getJobCompletionTrend(days);

    return NextResponse.json({
      success: true,
      trend,
    });
  } catch (error: any) {
    console.error('Error fetching job completion trend:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job completion trend' },
      { status: 500 }
    );
  }
}
