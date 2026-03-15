import { NextRequest, NextResponse } from 'next/server';
import {
  getDashboardStats,
  getAllTechniciansPerformance,
  getTechnicianPerformance,
  getJobStatistics,
  getTechnicianEarningsSummary,
  getJobCompletionTrend,
} from '@/services/technicianAnalyticsService';

/**
 * GET /api/technician-analytics/dashboard
 * Get dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const stats = await getDashboardStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
