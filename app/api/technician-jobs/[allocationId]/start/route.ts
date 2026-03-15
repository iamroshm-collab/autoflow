import { NextRequest, NextResponse } from 'next/server';
import { startJobAllocation } from '@/services/jobAllocationService';

/**
 * POST /api/technician-jobs/[allocationId]/start
 * Technician starts working on a job
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

    const allocation = await startJobAllocation(allocationId);

    return NextResponse.json({
      success: true,
      message: 'Job started successfully',
      allocation,
    });
  } catch (error: any) {
    console.error('Error starting job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start job' },
      { status: 500 }
    );
  }
}
