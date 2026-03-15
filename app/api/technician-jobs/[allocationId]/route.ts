import { NextRequest, NextResponse } from 'next/server';
import {
  getAllocationById,
  getTechnicianAllocations,
  getPendingAllocations,
} from '@/services/jobAllocationService';

/**
 * GET /api/technician-jobs/[allocationId]
 * Get details of a specific allocation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ allocationId: string }> }
) {
  try {
    const { allocationId } = await params;

    if (!allocationId) {
      return NextResponse.json(
        { error: 'allocationId is required' },
        { status: 400 }
      );
    }

    const allocation = await getAllocationById(allocationId);

    if (!allocation) {
      return NextResponse.json(
        { error: 'Allocation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      allocation,
    });
  } catch (error: any) {
    console.error('Error fetching allocation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch allocation' },
      { status: 500 }
    );
  }
}
