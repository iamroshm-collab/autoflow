import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdminLikeDesignation } from "@/lib/attendance"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

const parseDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const hasUnknownPrismaArgument = (error: unknown, fieldName: string) => {
  const message = error instanceof Error ? error.message : ""
  return message.includes(`Unknown argument \`${fieldName}\``)
}

const toEmployeeResponse = (employee: any) => {
  return employee
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() || ""
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true"

    const baseWhere = {
      isArchived: includeArchived ? undefined : false,
      ...(search
        ? {
            OR: [
              { empName: { contains: search, mode: "insensitive" as const } },
              { mobile: { contains: search } },
              { idNumber: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    let employees: any[]
    try {
      employees = await prisma.employee.findMany({
        where: baseWhere,
        orderBy: [{ empName: "asc" }, { employeeId: "asc" }],
        take: 200,
      })
    } catch (error) {
      const hasUnknownEmployeeEmail = hasUnknownPrismaArgument(error, "email")
      if (!hasUnknownEmployeeEmail) {
        throw error
      }

      employees = await prisma.employee.findMany({
        where: {
          isArchived: includeArchived ? undefined : false,
          ...(search
            ? {
                OR: [
                  { empName: { contains: search, mode: "insensitive" as const } },
                  { mobile: { contains: search } },
                  { idNumber: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ empName: "asc" }, { employeeId: "asc" }],
        take: 200,
      })
    }

    return NextResponse.json(employees.map(toEmployeeResponse))
  } catch (error) {
    console.error("[EMPLOYEES_GET]", error)
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const empName = String(body.empName || "").trim()
    const idNumber = String(body.idNumber || "").trim()
    const mobile = normalizeMobileNumber(body.mobile)

    if (!empName || !idNumber || !mobile) {
      return NextResponse.json(
        { error: "EmpName, IDNumber, and Mobile are required" },
        { status: 400 }
      )
    }

    if (!isValidMobileNumber(mobile)) {
      return NextResponse.json(
        { error: "Mobile must be exactly 10 digits" },
        { status: 400 }
      )
    }

    const designation = String(body.designation || "").trim() || null
    const employeeCreateData: Record<string, unknown> = {
      empName,
      idNumber,
      mobile,
      phoneNumber: mobile,
      isTechnician: Boolean(body.isTechnician),
      address: String(body.address || "").trim() || null,
      designation,
      salaryPerday: Number(body.salaryPerday || 0),
      startDate: parseDate(body.startDate),
      endDate: parseDate(body.endDate),
      attendance: String(body.attendance || "").trim() || null,
      attendanceDate: parseDate(body.attendanceDate),
      facePhotoUrl: String(body.facePhotoUrl || "").trim() || null,
      facePhotoUpdatedAt: body.facePhotoUrl ? new Date() : null,
      isAttendanceEligible: !isAdminLikeDesignation(designation) && body.isAttendanceEligible !== false,
    }

    let employee
    try {
      employee = await prisma.employee.create({
        data: employeeCreateData as any,
      })
    } catch (error) {
      const hasUnknownEmployeeEmail = hasUnknownPrismaArgument(error, "email")
      if (!hasUnknownEmployeeEmail) {
        throw error
      }

      employee = await prisma.employee.create({
        data: employeeCreateData as any,
      })
    }

    return NextResponse.json(toEmployeeResponse(employee), { status: 201 })
  } catch (error) {
    console.error("[EMPLOYEES_POST]", error)
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 })
  }
}
