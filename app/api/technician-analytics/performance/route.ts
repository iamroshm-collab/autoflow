import { NextRequest, NextResponse } from 'next/server';
import {
  getAllTechniciansPerformance,
  getTechnicianPerformance,
} from '@/services/technicianAnalyticsService';

/**
 * GET /api/technician-analytics/performance
 * Get performance metrics for all technicians or a specific one
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const technicianIdParam = searchParams.get('technicianId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    let performance;

    if (technicianIdParam) {
      const technicianId = Number(technicianIdParam);
      if (!Number.isInteger(technicianId)) {
        return NextResponse.json(
          { error: 'technicianId must be a valid employee ID' },
          { status: 400 }
        );
      }
      // Get performance for specific technician
      performance = await getTechnicianPerformance(technicianId, startDate, endDate);
    } else {
      // Get performance for all technicians
      performance = await getAllTechniciansPerformance(startDate, endDate);
    }

    return NextResponse.json({
      success: true,
      performance,
    });
  } catch (error: any) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
