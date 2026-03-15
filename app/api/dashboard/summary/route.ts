import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

type StatusBucket = "Completed" | "In Progress" | "Pending" | "Cancelled"

const STATUS_ORDER: StatusBucket[] = ["Completed", "In Progress", "Pending", "Cancelled"]

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short" })

const safe = async <T,>(run: () => Promise<T>, fallback: T) => {
  try {
    return await run()
  } catch (error) {
    console.warn("[DASHBOARD_SUMMARY_SAFE_FALLBACK]", error)
    return fallback
  }
}

const countFromTable = async (tableName: string) => {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*) as count FROM ${tableName}`
    )
    const value = rows?.[0]?.count ?? 0
    return typeof value === "bigint" ? Number(value) : Number(value || 0)
  } catch {
    return 0
  }
}

const normalizeStatus = (value?: string | null): StatusBucket => {
  const status = String(value || "").trim().toLowerCase()

  if (status.includes("deliver") || status.includes("complete")) {
    return "Completed"
  }

  if (status.includes("under service") || status.includes("progress")) {
    return "In Progress"
  }

  if (status.includes("cancel")) {
    return "Cancelled"
  }

  return "Pending"
}

const getMonthBuckets = (count: number) => {
  const now = new Date()

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      month: MONTH_FORMATTER.format(date),
      services: 0,
    }
  })
}

export async function GET() {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const monthlyBuckets = getMonthBuckets(8)
    const oldestMonth = new Date()
    oldestMonth.setHours(0, 0, 0, 0)
    oldestMonth.setMonth(oldestMonth.getMonth() - 7)
    oldestMonth.setDate(1)

    const [
      totalJobCards,
      todayService,
      totalCustomers,
      pendingBillingAggregate,
      statusRows,
      monthlyServiceRows,
      recentJobs,
    ] = await Promise.all([
      safe(async () => {
        const primaryCount = await prisma.jobCard.count()
        if (primaryCount > 0) {
          return primaryCount
        }
        const legacyCount = await countFromTable("JobCards")
        return legacyCount > 0 ? legacyCount : primaryCount
      }, 0),
      safe(
        () =>
          prisma.jobCard.count({
            where: {
              serviceDate: {
                gte: todayStart,
                lt: todayEnd,
              },
            },
          }),
        0
      ),
      safe(async () => {
        const primaryCount = await prisma.customer.count()
        if (primaryCount > 0) {
          return primaryCount
        }
        const legacyCount = await countFromTable("Customers")
        return legacyCount > 0 ? legacyCount : primaryCount
      }, 0),
      safe(
        () =>
          prisma.jobCard.aggregate({
            where: {
              balance: {
                gt: 0,
              },
            },
            _sum: {
              balance: true,
            },
          }),
        { _sum: { balance: 0 } }
      ),
      safe(
        () =>
          prisma.jobCard.groupBy({
            by: ['jobcardStatus'],
            _count: {
              id: true,
            },
          }),
        [] as Array<{ jobcardStatus: string; _count: { id: number } }>
      ),
      safe(
        () =>
          prisma.$queryRaw<Array<{ year: number; month: number; count: bigint }>>`
              SELECT 
                EXTRACT(YEAR FROM "serviceDate")::integer as year,
                EXTRACT(MONTH FROM "serviceDate")::integer as month,
                COUNT(*) as count
              FROM "public"."JobCard"
              WHERE "serviceDate" >= ${oldestMonth}
              GROUP BY EXTRACT(YEAR FROM "serviceDate"), EXTRACT(MONTH FROM "serviceDate")
              ORDER BY year, month
            `,
        [] as Array<{ year: number; month: number; count: bigint }>
      ),
      safe(
        () =>
          prisma.jobCard.findMany({
            orderBy: [{ serviceDate: "desc" }, { updatedAt: "desc" }],
            take: 6,
            select: {
              jobCardNumber: true,
              serviceDate: true,
              jobcardStatus: true,
              customer: {
                select: {
                  name: true,
                },
              },
              vehicle: {
                select: {
                  registrationNumber: true,
                },
              },
            },
          }),
        [] as Array<{
          jobCardNumber: string
          serviceDate: Date
          jobcardStatus: string
          customer: { name: string }
          vehicle: { registrationNumber: string }
        }>
      ),
    ])

    const statusMap = new Map<StatusBucket, number>()
    STATUS_ORDER.forEach((name) => statusMap.set(name, 0))

    statusRows.forEach((row) => {
      const key = normalizeStatus(row.jobcardStatus)
      statusMap.set(key, (statusMap.get(key) || 0) + row._count.id)
    })

    const monthlyMap = new Map(monthlyBuckets.map((item) => [item.key, item]))
    monthlyServiceRows.forEach((row) => {
      const key = `${row.year}-${String(row.month).padStart(2, "0")}`
      const target = monthlyMap.get(key)
      if (target) {
        target.services += Number(row.count)
      }
    })

    return NextResponse.json({
      metrics: {
        totalJobCards,
        todayService,
        pendingBilling: Number(pendingBillingAggregate?._sum?.balance || 0),
        totalCustomers,
      },
      serviceOverview: monthlyBuckets.map((item) => ({
        month: item.month,
        services: item.services,
      })),
      statusBreakdown: STATUS_ORDER.map((name) => ({
        name,
        value: statusMap.get(name) || 0,
      })),
      recentJobCards: recentJobs.map((row) => ({
        id: row.jobCardNumber,
        customer: row.customer?.name || "-",
        vehicle: row.vehicle?.registrationNumber || "-",
        date: new Date(row.serviceDate).toISOString().slice(0, 10),
        status: normalizeStatus(row.jobcardStatus),
      })),
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    console.error("[DASHBOARD_SUMMARY_GET]", error)
    return NextResponse.json({ error: "Failed to fetch dashboard summary" }, { status: 500 })
  }
}
