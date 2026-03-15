import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdminLikeDesignation } from "@/lib/attendance"

// GET - Fetch employees with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const includeArchived = searchParams.get("includeArchived") === "true"

    const where: any = {}

    if (!includeArchived) {
      where.isArchived = false
    }

    if (search) {
      where.OR = [
        { empName: { contains: search, mode: "insensitive" as const } },
        { mobile: { contains: search } },
        { idNumber: { contains: search } },
      ]
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        employeeId: true,
        empName: true,
        idNumber: true,
        mobile: true,
        designation: true,
        salaryPerday: true,
        isArchived: true,
      },
      orderBy: {
        empName: "asc",
      },
    })

    return NextResponse.json(employees.filter((employee) => !isAdminLikeDesignation(employee.designation)))
  } catch (error) {
    console.error("Error fetching employees:", error)
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 })
  }
}
