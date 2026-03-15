import { prisma } from '@/lib/prisma';

export interface AssignTechniciansParams {
  jobId: string;
  technicianIds: number[];
  earningAmount?: number;
  taskByTechnicianId?: Record<string, string>;
}

export interface UpdateAllocationStatusParams {
  allocationId: string;
  status: 'accepted' | 'in_progress' | 'completed';
  earningAmount?: number;
}

/**
 * Assign multiple technicians to a job
 * Creates TechnicianAllocation records for each technician
 */
export async function assignTechniciansToJob(params: AssignTechniciansParams) {
  const { jobId, technicianIds, earningAmount = 0, taskByTechnicianId = {} } = params;

  // Verify job exists
  const jobCard = await prisma.jobCard.findUnique({
    where: { id: jobId },
    include: {
      vehicle: true,
      customer: true,
    },
  });

  if (!jobCard) {
    throw new Error('Job card not found');
  }

  const uniqueEmployeeIds = [...new Set(technicianIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)))];
  if (uniqueEmployeeIds.length === 0) {
    throw new Error('No valid technician employee IDs provided');
  }

  const technicians = await prisma.employee.findMany({
    where: {
      employeeId: { in: uniqueEmployeeIds },
      isTechnician: true,
      isArchived: false,
    },
    select: {
      employeeId: true,
      empName: true,
      mobile: true,
    },
  });

  if (technicians.length !== uniqueEmployeeIds.length) {
    throw new Error('One or more selected employees are not active technicians');
  }

  // Create allocation records for each technician
  const allocations = await Promise.all(
    uniqueEmployeeIds.map((employeeId) =>
      prisma.technicianAllocation.create({
        data: {
          jobId,
          employeeId,
          status: 'assigned',
          earningAmount,
          taskAssigned: String(taskByTechnicianId[String(employeeId)] || '').trim(),
          assignedAt: new Date(),
        },
        include: {
          employee: true,
          jobCard: {
            include: {
              vehicle: true,
              customer: true,
            },
          },
        },
      })
    )
  );

  return {
    allocations,
    jobCard,
  };
}

/**
 * Accept a job assignment
 * Updates allocation status to 'accepted' and records acceptance timestamp
 */
export async function acceptJobAllocation(allocationId: string) {
  const allocation = await prisma.technicianAllocation.findUnique({
    where: { id: allocationId },
  });

  if (!allocation) {
    throw new Error('Allocation not found');
  }

  if (allocation.status !== 'assigned') {
    throw new Error(`Cannot accept job in status: ${allocation.status}`);
  }

  return await prisma.technicianAllocation.update({
    where: { id: allocationId },
    data: {
      status: 'accepted',
      acceptedAt: new Date(),
    },
    include: {
      employee: true,
      jobCard: {
        include: {
          vehicle: true,
          customer: true,
        },
      },
    },
  });
}

/**
 * Start working on a job
 * Updates allocation status to 'in_progress' and records start timestamp
 */
export async function startJobAllocation(allocationId: string) {
  const allocation = await prisma.technicianAllocation.findUnique({
    where: { id: allocationId },
  });

  if (!allocation) {
    throw new Error('Allocation not found');
  }

  if (allocation.status !== 'accepted') {
    throw new Error(`Cannot start job in status: ${allocation.status}`);
  }

  return await prisma.technicianAllocation.update({
    where: { id: allocationId },
    data: {
      status: 'in_progress',
      startedAt: new Date(),
    },
    include: {
      employee: true,
      jobCard: {
        include: {
          vehicle: true,
          customer: true,
        },
      },
    },
  });
}

/**
 * Complete a job
 * Updates allocation status to 'completed', records completion timestamp, and calculates duration
 */
export async function completeJobAllocation(
  allocationId: string,
  earningAmount?: number
) {
  const allocation = await prisma.technicianAllocation.findUnique({
    where: { id: allocationId },
  });

  if (!allocation) {
    throw new Error('Allocation not found');
  }

  if (allocation.status !== 'in_progress') {
    throw new Error(`Cannot complete job in status: ${allocation.status}`);
  }

  if (!allocation.startedAt) {
    throw new Error('Job was not started properly');
  }

  const completedAt = new Date();
  const jobDuration = Math.floor(
    (completedAt.getTime() - allocation.startedAt.getTime()) / (1000 * 60)
  ); // Duration in minutes

  return await prisma.technicianAllocation.update({
    where: { id: allocationId },
    data: {
      status: 'completed',
      completedAt,
      jobDuration,
      ...(earningAmount !== undefined && { earningAmount }),
    },
    include: {
      employee: true,
      jobCard: {
        include: {
          vehicle: true,
          customer: true,
        },
      },
    },
  });
}

/**
 * Get all allocations for a specific job
 */
export async function getJobAllocations(jobId: string) {
  return await prisma.technicianAllocation.findMany({
    where: { jobId },
    include: {
      employee: true,
      jobCard: {
        include: {
          vehicle: true,
          customer: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Get all allocations for a specific technician
 */
export async function getTechnicianAllocations(
  technicianId: number,
  status?: string
) {
  return await prisma.technicianAllocation.findMany({
    where: {
      employeeId: technicianId,
      ...(status && { status }),
    },
    include: {
      employee: true,
      jobCard: {
        include: {
          vehicle: true,
          customer: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Get pending allocations for a technician (assigned or accepted)
 */
export async function getPendingAllocations(technicianId: number) {
  return await prisma.technicianAllocation.findMany({
    where: {
      employeeId: technicianId,
      status: {
        in: ['assigned', 'accepted', 'in_progress'],
      },
    },
    include: {
      employee: true,
      jobCard: {
        include: {
          vehicle: true,
          customer: true,
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });
}

/**
 * Get a single allocation by ID
 */
export async function getAllocationById(allocationId: string) {
  return await prisma.technicianAllocation.findUnique({
    where: { id: allocationId },
    include: {
      employee: true,
      jobCard: {
        include: {
          vehicle: true,
          customer: true,
        },
      },
    },
  });
}
