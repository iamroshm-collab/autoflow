import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function toTurnaroundMinutes(assignedAt: Date, completedAt: Date | null, status: string) {
  const end = completedAt ?? (status === "completed" ? assignedAt : new Date())
  const diffMs = end.getTime() - assignedAt.getTime()
  return Math.max(0, Math.floor(diffMs / 60000))
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = (searchParams.get("status") || "all").trim()
    const search = (searchParams.get("search") || "").trim()

    const where: any = {}

    if (status !== "all") {
      where.status = status
    }

    if (search) {
      const numericSearch = Number(search)
      where.OR = [
        {
          taskAssigned: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          employee: {
            empName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          jobCard: {
            jobCardNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          jobCard: {
            vehicle: {
              registrationNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ]

      if (Number.isInteger(numericSearch)) {
        where.OR.push({ employeeId: numericSearch })
      }
    }

    const rows = await prisma.technicianAllocation.findMany({
      where,
      include: {
        employee: {
          select: {
            employeeId: true,
            empName: true,
          },
        },
        jobCard: {
          select: {
            id: true,
            jobCardNumber: true,
            vehicle: {
              select: {
                registrationNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        assignedAt: "desc",
      },
      take: 300,
    })

    const allocations = rows.map((row) => {
      const turnaroundMinutes = toTurnaroundMinutes(row.assignedAt, row.completedAt, row.status)

      return {
        id: row.id,
        employeeId: row.employeeId,
        technicianName: row.employee?.empName || "-",
        jobCardId: row.jobId,
        jobCardNumber: row.jobCard?.jobCardNumber || row.jobId,
        vehicleNumber: row.jobCard?.vehicle?.registrationNumber || "-",
        status: row.status,
        taskAssigned: row.taskAssigned || "-",
        assignedAt: row.assignedAt,
        acceptedAt: row.acceptedAt,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        turnaroundMinutes,
      }
    })

    return NextResponse.json({
      success: true,
      allocations,
    })
  } catch (error: any) {
    console.error("[TECHNICIAN_TASK_DETAILS_GET]", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch technician task details" },
      { status: 500 }
    )
  }
}
