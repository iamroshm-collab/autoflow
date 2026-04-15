import { prisma } from "@/lib/prisma"

export interface EmployeeStatsResponse {
  totalJobsDone: number
  vehiclesAttended: number
  breakdownPickups: number
  avgTurnaround: number
  totalIncome: number
  serviceOverview: Array<{
    month: string
    services: number
    income: number
    vehicles: number
    avgTurnaround: number
  }>
  attendanceRecords: Array<{
    date: string
    attendance: string
    salaryAdvance: number
    incentive: number
    allowance: number
    workedMinutes: number | null
  }>
}

export async function getEmployeeStats(employeeId: number): Promise<EmployeeStatsResponse> {
  const db = prisma as any

  const allocations = await db.technicianAllocation.findMany({
    where: { employeeId },
    include: {
      jobCard: {
        select: {
          vehicle: { select: { id: true, registrationNumber: true } },
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  })

  const appUser = await db.appUser.findFirst({
    where: { employeeRefId: employeeId },
    select: { id: true },
  })

  let breakdownPickups = 0
  if (appUser?.id) {
    breakdownPickups = await db.breakdown.count({
      where: { acceptedByUserId: appUser.id },
    })
  }

  const attendanceRecords = await db.attendancePayroll.findMany({
    where: { employeeId },
    orderBy: { attendanceDate: "asc" },
    select: {
      attendanceDate: true,
      attendance: true,
      salaryAdvance: true,
      incentive: true,
      allowance: true,
      workedMinutes: true,
    },
  })

  const completed = allocations.filter((a: any) => a.status === "completed")
  const totalJobsDone = completed.length

  const vehicleSet = new Set<string>()
  completed.forEach((a: any) => {
    const vid = a.jobCard?.vehicle?.registrationNumber || a.jobCard?.vehicle?.id
    if (vid) vehicleSet.add(String(vid))
  })
  const vehiclesAttended = vehicleSet.size

  const durations = completed.map((a: any) => a.jobDuration).filter(Boolean) as number[]
  const avgTurnaround =
    durations.length > 0
      ? Math.round(durations.reduce((s: number, v: number) => s + v, 0) / durations.length)
      : 0

  const totalIncome = allocations.reduce((s: number, a: any) => s + (a.earningAmount || 0), 0)

  const monthMap = new Map<
    string,
    { services: number; income: number; durations: number[]; vehicleIds: Set<string> }
  >()

  allocations.forEach((a: any) => {
    const d = a.assignedAt ? new Date(a.assignedAt) : null
    if (!d) return
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const existing = monthMap.get(key) || {
      services: 0,
      income: 0,
      durations: [],
      vehicleIds: new Set<string>(),
    }
    existing.services++
    existing.income += a.earningAmount || 0
    if (a.status === "completed" && a.jobDuration) existing.durations.push(a.jobDuration)
    if (a.status === "completed") {
      const vid = a.jobCard?.vehicle?.registrationNumber || a.jobCard?.vehicle?.id
      if (vid) existing.vehicleIds.add(String(vid))
    }
    monthMap.set(key, existing)
  })

  const serviceOverview = Array.from(monthMap.entries())
    .map(([key, { services, income, durations, vehicleIds }]) => {
      const [y, m] = key.split("-")
      const date = new Date(Number(y), Number(m) - 1, 1)
      return {
        month: date.toLocaleString("en", {
          month: "short",
          year: "numeric",
        }),
        services,
        income,
        vehicles: vehicleIds.size,
        avgTurnaround:
          durations.length > 0
            ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)
            : 0,
      }
    })
    .sort((a, b) => {
      const [am, ay] = a.month.split(" ")
      const [bm, by] = b.month.split(" ")
      return new Date(`${am} 1 ${ay}`).getTime() - new Date(`${bm} 1 ${by}`).getTime()
    })

  return {
    totalJobsDone,
    vehiclesAttended,
    breakdownPickups,
    avgTurnaround,
    totalIncome,
    serviceOverview,
    attendanceRecords: attendanceRecords.map((r: any) => ({
      date: new Date(r.attendanceDate).toISOString().slice(0, 10),
      attendance: r.attendance,
      salaryAdvance: r.salaryAdvance ?? 0,
      incentive: r.incentive ?? 0,
      allowance: r.allowance ?? 0,
      workedMinutes: r.workedMinutes,
    })),
  }
}
