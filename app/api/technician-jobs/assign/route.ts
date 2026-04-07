import { NextRequest, NextResponse } from 'next/server';
import {
  assignTechniciansToJob,
  getJobAllocations,
} from '@/services/jobAllocationService';
import { sendJobAssignmentNotifications } from '@/services/notificationService';
import { sendMetaWhatsappJobCardAssigned } from '@/lib/meta-whatsapp';

/**
 * POST /api/technician-jobs/assign
 * Assign one or multiple technicians to a job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, technicianIds, earningAmount, taskByTechnicianId } = body;
    const parsedTechnicianIds = Array.isArray(technicianIds)
      ? technicianIds
          .map((id: string | number) => Number(id))
          .filter((id: number) => Number.isInteger(id))
      : [];

    // Validate input
    if (!jobId || !Array.isArray(technicianIds)) {
      return NextResponse.json(
        { error: 'jobId and technicianIds array are required' },
        { status: 400 }
      );
    }

    if (parsedTechnicianIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one technician must be assigned' },
        { status: 400 }
      );
    }

    // Assign technicians to job
    const result = await assignTechniciansToJob({
      jobId,
      technicianIds: parsedTechnicianIds,
      earningAmount,
      taskByTechnicianId:
        taskByTechnicianId && typeof taskByTechnicianId === 'object'
          ? Object.fromEntries(
              Object.entries(taskByTechnicianId).map(([key, value]) => [
                String(key),
                typeof value === 'string' ? value : String(value ?? ''),
              ])
            )
          : {},
    });

    // Get server URL for notification links
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';

    // Send push notifications to assigned technicians
    try {
      await sendJobAssignmentNotifications(
        parsedTechnicianIds,
        {
          jobId,
          vehicleNumber: result.jobCard.vehicle.registrationNumber,
        },
        serverUrl
      );
    } catch (notificationError) {
      console.error('Failed to send notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    // Send WhatsApp notification to each assigned technician
    const technicianMap = new Map(
      result.allocations.map((a) => [a.employeeId, a])
    );
    await Promise.allSettled(
      parsedTechnicianIds.map((empId) => {
        const allocation = technicianMap.get(empId);
        const techMobile = allocation?.employee?.mobile;
        if (!techMobile) return Promise.resolve();
        return sendMetaWhatsappJobCardAssigned({
          mobile: techMobile,
          vehicleMake: result.jobCard.vehicle?.make || '',
          vehicleModel: result.jobCard.vehicle?.model || '',
          regNumber: result.jobCard.vehicle?.registrationNumber || '',
          jobType: allocation?.taskAssigned || 'Service',
          technicianName: allocation?.employee?.empName || '',
        }).catch((err) => console.error('[TECHNICIAN_ASSIGN_WA]', err));
      })
    );

    return NextResponse.json(
      {
        success: true,
        message: `Successfully assigned ${parsedTechnicianIds.length} technician(s) to job`,
        allocations: result.allocations,
        jobCard: result.jobCard,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error assigning technicians:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign technicians' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/technician-jobs/assign?jobId=xxx
 * Get all allocations for a specific job
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const allocations = await getJobAllocations(jobId);

    return NextResponse.json({
      success: true,
      allocations,
    });
  } catch (error: any) {
    console.error('Error fetching job allocations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job allocations' },
      { status: 500 }
    );
  }
}
