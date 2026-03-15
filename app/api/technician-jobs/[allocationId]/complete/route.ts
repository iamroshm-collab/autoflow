import { NextRequest, NextResponse } from 'next/server';
import { completeJobAllocation } from '@/services/jobAllocationService';

/**
 * POST /api/technician-jobs/[allocationId]/complete
 * Technician completes a job
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

    const body = await request.json().catch(() => ({}));
    const { earningAmount } = body;

    const allocation = await completeJobAllocation(allocationId, earningAmount);

    return NextResponse.json({
      success: true,
      message: 'Job completed successfully',
      allocation,
    });
  } catch (error: any) {
    console.error('Error completing job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete job' },
      { status: 500 }
    );
  }
}
