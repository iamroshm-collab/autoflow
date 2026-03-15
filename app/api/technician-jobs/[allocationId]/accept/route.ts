import { NextRequest, NextResponse } from 'next/server';
import { acceptJobAllocation } from '@/services/jobAllocationService';

/**
 * POST /api/technician-jobs/[allocationId]/accept
 * Technician accepts a job assignment
 */
export async function POST(
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

    const allocation = await acceptJobAllocation(allocationId);

    return NextResponse.json({
      success: true,
      message: 'Job accepted successfully',
      allocation,
    });
  } catch (error: any) {
    console.error('Error accepting job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to accept job' },
      { status: 500 }
    );
  }
}
