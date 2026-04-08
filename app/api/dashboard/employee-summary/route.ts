import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short" })

const safe = async <T,>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run()
  } catch (error) {
    console.warn("[EMPLOYEE_DASHBOARD_SAFE_FALLBACK]", error)
    return fallback
  }
}

const getMonthBuckets = (count: number) => {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      month: MONTH_FORMATTER.format(date),
      jobs: 0,
    }
  })
}

const getTodayRangeIST = () => {
  // Use IST offset (+5:30) to get today's boundaries
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffset)
  const y = istNow.getUTCFullYear()
  const m = istNow.getUTCMonth()
  const d = istNow.getUTCDate()
  const todayStart = new Date(Date.UTC(y, m, d) - istOffset)
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  return { todayStart, todayEnd }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeIdParam = searchParams.get("employeeId")
  const employeeId = employeeIdParam ? parseInt(employeeIdParam, 10) : null

  if (!employeeId || isNaN(employeeId) || employeeId <= 0) {
    return NextResponse.json({ error: "Invalid employeeId" }, { status: 400 })
  }

  const { todayStart, todayEnd } = getTodayRangeIST()

  const monthlyBuckets = getMonthBuckets(8)
  const oldestMonth = new Date()
  oldestMonth.setHours(0, 0, 0, 0)
  oldestMonth.setMonth(oldestMonth.getMonth() - 7)
  oldestMonth.setDate(1)

  const [
    totalDone,
    todayDone,
    todayPending,
    avgDurationResult,
    monthlyRows,
    vehicleRows,
  ] = await Promise.all([
    // Total tasks completed by this employee ever
    safe(
      () =>
        prisma.technicianAllocation.count({
          where: { employeeId, status: "completed" },
        }),
      0
    ),

    // Tasks completed today
    safe(
      () =>
        prisma.technicianAllocation.count({
          where: {
            employeeId,
            status: "completed",
            completedAt: { gte: todayStart, lt: todayEnd },
          },
        }),
      0
    ),

    // Tasks assigned today but not yet completed (pending/in-progress)
    safe(
      () =>
        prisma.technicianAllocation.count({
          where: {
            employeeId,
            status: { in: ["assigned", "accepted", "in_progress"] },
            assignedAt: { gte: todayStart, lt: todayEnd },
          },
        }),
      0
    ),

    // Average turnaround time (minutes) from completed tasks that have a duration
    safe(
      () =>
        prisma.technicianAllocation.aggregate({
          where: {
            employeeId,
            status: "completed",
            jobDuration: { not: null },
          },
          _avg: { jobDuration: true },
          _count: { jobDuration: true },
        }),
      { _avg: { jobDuration: null }, _count: { jobDuration: 0 } }
    ),

    // Monthly completed tasks for the last 8 months
    safe(
      () =>
        prisma.technicianAllocation.findMany({
          where: {
            employeeId,
            status: "completed",
            completedAt: { gte: oldestMonth },
          },
          select: { completedAt: true },
        }),
      [] as Array<{ completedAt: Date | null }>
    ),

    // Distinct vehicles this employee has worked on (via jobCard.vehicleId)
    safe(
      () =>
        prisma.technicianAllocation.findMany({
          where: { employeeId },
          select: {
            jobCard: { select: { vehicleId: true } },
          },
          distinct: ["jobId"],
        }),
      [] as Array<{ jobCard: { vehicleId: string } }>
    ),
  ])

  // Count distinct vehicles
  const uniqueVehicles = new Set(vehicleRows.map((r) => r.jobCard?.vehicleId).filter(Boolean)).size

  // Build monthly buckets from raw rows
  const monthlyMap = new Map(monthlyBuckets.map((b) => [b.key, b]))
  for (const row of monthlyRows) {
    if (!row.completedAt) continue
    const d = new Date(row.completedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const bucket = monthlyMap.get(key)
    if (bucket) bucket.jobs += 1
  }

  // Format turnaround time
  const avgMinutes = avgDurationResult._avg.jobDuration
  let turnaroundLabel = "—"
  if (avgMinutes != null && avgMinutes > 0) {
    const mins = Math.round(avgMinutes)
    if (mins < 60) {
      turnaroundLabel = `${mins} min`
    } else {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      turnaroundLabel = m > 0 ? `${h}h ${m}m` : `${h}h`
    }
  }

  return NextResponse.json(
    {
      metrics: {
        totalDone,
        todayDone,
        todayPending,
        uniqueVehicles,
        turnaroundLabel,
        avgMinutes: avgMinutes ?? null,
      },
      monthlyOverview: monthlyBuckets.map((b) => ({ month: b.month, jobs: b.jobs })),
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  )
}
