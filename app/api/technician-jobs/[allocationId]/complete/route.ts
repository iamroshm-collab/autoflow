import { NextRequest, NextResponse } from 'next/server';
import { completeJobAllocation } from '@/services/jobAllocationService';
import { createRoleNotifications } from '@/lib/app-notifications';
import { sendTechnicianCompletedNotification } from '@/services/notificationService';

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
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || request.nextUrl.origin;

    await createRoleNotifications(["admin", "manager"], {
      title: "Job Completed",
      body: `${allocation.employee?.empName || "Technician"} completed ${allocation.jobCard?.vehicle?.registrationNumber || "a job"}`,
      url: `/job/${allocation.jobId}`,
      type: "job_completed",
    });

    void sendTechnicianCompletedNotification(serverUrl, {
      allocationId: allocation.id,
      jobId: allocation.jobId,
      technicianName: allocation.employee?.empName || "Technician",
      vehicleNumber: allocation.jobCard?.vehicle?.registrationNumber || "Unknown vehicle",
    }).catch((error) => {
      console.error('[TECHNICIAN_JOB_COMPLETE_NOTIFICATION]', error);
    });

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
