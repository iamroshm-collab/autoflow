import { prisma } from '@/lib/prisma';

const db: any = prisma;

export interface TechnicianPerformance {
  technicianId: number;
  technicianName: string;
  totalJobsCompleted: number;
  averageCompletionTime: number;
  totalEarnings: number;
  activeJobs: number;
}

export interface JobStatistics {
  totalJobs: number;
  assignedJobs: number;
  acceptedJobs: number;
  inProgressJobs: number;
  completedJobs: number;
}

export interface DashboardStats {
  today: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
  };
  thisWeek: {
    totalJobs: number;
    completedJobs: number;
  };
  thisMonth: {
    totalJobs: number;
    completedJobs: number;
    totalEarnings: number;
  };
}

export async function getTechnicianPerformance(
  technicianId: number,
  startDate?: Date,
  endDate?: Date
): Promise<TechnicianPerformance> {
  const technician = await db.employee.findFirst({
    where: { employeeId: technicianId, isTechnician: true },
  });

  if (!technician) {
    throw new Error('Technician not found');
  }

  const dateFilter = {
    ...(startDate && { gte: startDate }),
    ...(endDate && { lte: endDate }),
  };

  const completedJobs = await db.technicianAllocation.count({
    where: {
      employeeId: technicianId,
      status: 'completed',
      ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
    },
  });

  const completedAllocations = await db.technicianAllocation.findMany({
    where: {
      employeeId: technicianId,
      status: 'completed',
      jobDuration: { not: null },
      ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
    },
    select: {
      jobDuration: true,
    },
  });

  const avgCompletionTime =
    completedAllocations.length > 0
      ? completedAllocations.reduce((sum: number, allocation: any) => sum + (allocation.jobDuration || 0), 0) /
        completedAllocations.length
      : 0;

  const earningsData = await db.technicianAllocation.aggregate({
    where: {
      employeeId: technicianId,
      status: 'completed',
      ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
    },
    _sum: {
      earningAmount: true,
    },
  });

  const activeJobs = await db.technicianAllocation.count({
    where: {
      employeeId: technicianId,
      status: {
        in: ['assigned', 'accepted', 'in_progress'],
      },
    },
  });

  return {
    technicianId,
    technicianName: technician.empName,
    totalJobsCompleted: completedJobs,
    averageCompletionTime: Math.round(avgCompletionTime),
    totalEarnings: earningsData._sum.earningAmount ?? 0,
    activeJobs,
  };
}

export async function getAllTechniciansPerformance(
  startDate?: Date,
  endDate?: Date
): Promise<TechnicianPerformance[]> {
  const technicians = await db.employee.findMany({
    where: { isTechnician: true, isArchived: false },
    orderBy: { empName: 'asc' },
  });

  return await Promise.all(
    technicians.map((tech: any) => getTechnicianPerformance(tech.employeeId, startDate, endDate))
  );
}

export async function getJobStatistics(
  startDate?: Date,
  endDate?: Date
): Promise<JobStatistics> {
  const dateFilter = {
    ...(startDate && { gte: startDate }),
    ...(endDate && { lte: endDate }),
  };

  const stats = await db.technicianAllocation.groupBy({
    by: ['status'],
    where: {
      ...(Object.keys(dateFilter).length > 0 && { assignedAt: dateFilter }),
    },
    _count: {
      id: true,
    },
  });

  const result: JobStatistics = {
    totalJobs: 0,
    assignedJobs: 0,
    acceptedJobs: 0,
    inProgressJobs: 0,
    completedJobs: 0,
  };

  stats.forEach((stat: any) => {
    result.totalJobs += stat._count.id;

    switch (stat.status) {
      case 'assigned':
        result.assignedJobs = stat._count.id;
        break;
      case 'accepted':
        result.acceptedJobs = stat._count.id;
        break;
      case 'in_progress':
        result.inProgressJobs = stat._count.id;
        break;
      case 'completed':
        result.completedJobs = stat._count.id;
        break;
    }
  });

  return result;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayTotal = await db.technicianAllocation.count({
    where: { assignedAt: { gte: todayStart } },
  });

  const todayActive = await db.technicianAllocation.count({
    where: {
      assignedAt: { gte: todayStart },
      status: { in: ['assigned', 'accepted', 'in_progress'] },
    },
  });

  const todayCompleted = await db.technicianAllocation.count({
    where: {
      assignedAt: { gte: todayStart },
      status: 'completed',
    },
  });

  const weekTotal = await db.technicianAllocation.count({
    where: { assignedAt: { gte: weekStart } },
  });

  const weekCompleted = await db.technicianAllocation.count({
    where: {
      assignedAt: { gte: weekStart },
      status: 'completed',
    },
  });

  const monthTotal = await db.technicianAllocation.count({
    where: { assignedAt: { gte: monthStart } },
  });

  const monthCompleted = await db.technicianAllocation.count({
    where: {
      assignedAt: { gte: monthStart },
      status: 'completed',
    },
  });

  const monthEarnings = await db.technicianAllocation.aggregate({
    where: {
      assignedAt: { gte: monthStart },
      status: 'completed',
    },
    _sum: {
      earningAmount: true,
    },
  });

  return {
    today: {
      totalJobs: todayTotal,
      activeJobs: todayActive,
      completedJobs: todayCompleted,
    },
    thisWeek: {
      totalJobs: weekTotal,
      completedJobs: weekCompleted,
    },
    thisMonth: {
      totalJobs: monthTotal,
      completedJobs: monthCompleted,
      totalEarnings: monthEarnings._sum.earningAmount ?? 0,
    },
  };
}

export async function getTechnicianEarningsSummary(
  startDate?: Date,
  endDate?: Date
) {
  const dateFilter = {
    ...(startDate && { gte: startDate }),
    ...(endDate && { lte: endDate }),
  };

  const earnings = await db.technicianAllocation.groupBy({
    by: ['employeeId'],
    where: {
      status: 'completed',
      ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
    },
    _sum: {
      earningAmount: true,
    },
    _count: {
      id: true,
    },
  });

  const technicianIds = earnings.map((e: any) => e.employeeId);
  const technicians = await db.employee.findMany({
    where: {
      employeeId: { in: technicianIds },
    },
    select: {
      employeeId: true,
      empName: true,
    },
  });

  const technicianMap = new Map(technicians.map((t: any) => [t.employeeId, t.empName]));

  return earnings.map((earning: any) => ({
    technicianId: earning.employeeId,
    technicianName: technicianMap.get(earning.employeeId) || 'Unknown',
    totalJobs:
      typeof earning._count === 'object' && earning._count && 'id' in earning._count
        ? earning._count.id || 0
        : 0,
    totalEarnings: earning._sum?.earningAmount ?? 0,
  }));
}

export async function getJobCompletionTrend(days: number = 7) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);

  const allocations = await db.technicianAllocation.findMany({
    where: {
      completedAt: {
        gte: startDate,
      },
      status: 'completed',
    },
    select: {
      completedAt: true,
    },
  });

  const trendData: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    trendData[dateKey] = 0;
  }

  allocations.forEach((allocation: any) => {
    if (allocation.completedAt) {
      const dateKey = allocation.completedAt.toISOString().split('T')[0];
      if (trendData[dateKey] !== undefined) {
        trendData[dateKey]++;
      }
    }
  });

  return Object.entries(trendData)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

