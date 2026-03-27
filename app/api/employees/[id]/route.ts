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

    return NextResponse.json(toEmployeeResponse(employee))
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
    const shouldDeregisterDevice = body.deregisterDevice === true
    const employeeUpdateData: Record<string, unknown> = {
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
      ...(shouldDeregisterDevice
        ? {
            registeredDeviceId: null,
            registeredDeviceIp: null,
            deviceRegisteredAt: null,
          }
        : {}),
    }

    let updated
    try {
      updated = await prisma.employee.update({
        where: { employeeId },
        data: employeeUpdateData,
      })
    } catch (error) {
      const hasUnknownDeviceFields =
        hasUnknownPrismaArgument(error, "registeredDeviceId") ||
        hasUnknownPrismaArgument(error, "registeredDeviceIp") ||
        hasUnknownPrismaArgument(error, "deviceRegisteredAt")

      if (!hasUnknownDeviceFields) {
        throw error
      }

      const fallbackUpdateData = { ...employeeUpdateData }
      if (hasUnknownDeviceFields) {
        delete fallbackUpdateData.registeredDeviceId
        delete fallbackUpdateData.registeredDeviceIp
        delete fallbackUpdateData.deviceRegisteredAt
      }

      updated = await prisma.employee.update({
        where: { employeeId },
        data: fallbackUpdateData,
      })
    }

    if (shouldDeregisterDevice) {
      try {
        await prisma.appUser.updateMany({
          where: { employeeRefId: employeeId },
          data: {
            approvedDeviceId: null,
            approvedDeviceIp: null,
            pendingDeviceId: null,
            pendingDeviceIp: null,
            requestedDeviceId: null,
            requestedDeviceIp: null,
            deviceApprovalStatus: "none",
          },
        })
      } catch (error) {
        const hasUnknownDeviceField =
          hasUnknownPrismaArgument(error, "approvedDeviceId") ||
          hasUnknownPrismaArgument(error, "approvedDeviceIp") ||
          hasUnknownPrismaArgument(error, "pendingDeviceId") ||
          hasUnknownPrismaArgument(error, "pendingDeviceIp") ||
          hasUnknownPrismaArgument(error, "requestedDeviceId") ||
          hasUnknownPrismaArgument(error, "requestedDeviceIp") ||
          hasUnknownPrismaArgument(error, "deviceApprovalStatus")

        if (!hasUnknownDeviceField) {
          console.error("[EMPLOYEE_BY_ID_PUT_DEREGISTER_DEVICE]", error)
        }
      }
    }

    return NextResponse.json(toEmployeeResponse(updated))
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

    const result = await prisma.$transaction(async (tx) => {
      const linkedUsers = await tx.appUser.findMany({
        where: { employeeRefId: employeeId },
        select: { id: true, mobile: true },
      })

      if (linkedUsers.length > 0) {
        await tx.appUser.deleteMany({
          where: { id: { in: linkedUsers.map((user) => user.id) } },
        })
      }

      const archivedEmployee = await tx.employee.update({
        where: { employeeId },
        data: {
          isArchived: true,
          endDate: existing.endDate ?? new Date(),
        },
      })

      return {
        employee: archivedEmployee,
        removedLoginUsers: linkedUsers.length,
        removedUserMobiles: linkedUsers.map((user) => user.mobile).filter(Boolean),
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[EMPLOYEE_BY_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to archive employee" }, { status: 500 })
  }
}
