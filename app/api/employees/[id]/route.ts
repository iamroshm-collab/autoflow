import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdminLikeDesignation } from "@/lib/attendance"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

const parseDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getEmployeeId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  const employeeId = Number(id)
  return Number.isInteger(employeeId) ? employeeId : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employeeId = await getEmployeeId(params)
    if (employeeId === null) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 })
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: {
        attendancePayrolls: {
          orderBy: { attendanceDate: "desc" },
          take: 31,
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error("[EMPLOYEE_BY_ID_GET]", error)
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employeeId = await getEmployeeId(params)
    if (employeeId === null) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 })
    }

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
    const updated = await prisma.employee.update({
      where: { employeeId },
      data: {
        empName,
        idNumber,
        mobile,
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
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[EMPLOYEE_BY_ID_PUT]", error)
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employeeId = await getEmployeeId(params)
    if (employeeId === null) {
      return NextResponse.json({ error: "Invalid employee id" }, { status: 400 })
    }

    const existing = await prisma.employee.findUnique({ where: { employeeId } })
    if (!existing) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const archived = await prisma.employee.update({
      where: { employeeId },
      data: {
        isArchived: true,
        endDate: existing.endDate ?? new Date(),
      },
    })

    return NextResponse.json({ success: true, employee: archived })
  } catch (error) {
    console.error("[EMPLOYEE_BY_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to archive employee" }, { status: 500 })
  }
}
