import { NextRequest, NextResponse } from 'next/server';
import { getTechnicianAllocations, getPendingAllocations } from '@/services/jobAllocationService';

/**
 * GET /api/technicians/[id]/jobs
 * Get all jobs for a specific technician
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { error: 'Invalid technician id' },
        { status: 400 }
      );
    }
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const pending = searchParams.get('pending') === 'true';

    let allocations;

    if (pending) {
      // Get only pending allocations (assigned, accepted, in_progress)
      allocations = await getPendingAllocations(id);
    } else if (status) {
      // Filter by specific status
      allocations = await getTechnicianAllocations(id, status);
    } else {
      // Get all allocations
      allocations = await getTechnicianAllocations(id);
    }

    return NextResponse.json({
      success: true,
      allocations,
    });
  } catch (error: any) {
    console.error('Error fetching technician jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch technician jobs' },
      { status: 500 }
    );
  }
}
