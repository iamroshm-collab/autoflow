import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { composeAddress } from "@/lib/address-utils"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"
import { isAdminLikeDesignation } from "@/lib/attendance"

const prismaClient = prisma as any

const generateEmployeeIdNumber = () => {
  const stamp = Date.now().toString().slice(-8)
  const random = Math.floor(Math.random() * 900 + 100)
  return `AUTO-${stamp}${random}`
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.approvalStatus !== "approved") {
      return NextResponse.json({ error: "Your account is not approved yet." }, { status: 403 })
    }

    const body = await request.json()
    const mobile = normalizeMobileNumber(body?.mobile)
    const idNumber = String(body?.idNumber || "").replace(/\D/g, "").trim()
    const designation = String(currentUser.designation || "").trim()
    const addressLine1 = String(body?.addressLine1 || "").trim()
    const addressLine2 = String(body?.addressLine2 || "").trim()
    const city = String(body?.city || "").trim()
    const state = String(body?.state || "").trim()
    const postalCode = String(body?.postalCode || "").trim()
    const address = composeAddress({
      line1: addressLine1,
      line2: addressLine2,
      city,
      state,
      postalCode,
    })

    if (!mobile || !idNumber || !addressLine1 || !addressLine2 || !city || !state || !postalCode) {
      return NextResponse.json({ error: "All profile fields are mandatory" }, { status: 400 })
    }

    if (!designation) {
      return NextResponse.json(
        { error: "Designation is assigned by admin. Please contact admin to set it before completing your profile." },
        { status: 400 }
      )
    }

    if (!isValidMobileNumber(mobile)) {
      return NextResponse.json({ error: "Mobile must be exactly 10 digits" }, { status: 400 })
    }

    if (!/^\d{12}$/.test(idNumber)) {
      return NextResponse.json({ error: "Aadhaar ID must be exactly 12 digits" }, { status: 400 })
    }

    let employeeRefId: number | null = currentUser.employeeRefId ?? null

    if (employeeRefId) {
      const employeeUpdateData: Record<string, unknown> = {
        empName: currentUser.name,
        idNumber,
        mobile,
        phoneNumber: mobile,
        address,
        designation,
        isTechnician: currentUser.role === "technician",
        isAttendanceEligible: !isAdminLikeDesignation(designation),
      }

      await prismaClient.employee.update({
        where: { employeeId: employeeRefId },
        data: employeeUpdateData,
      })
    } else {
      const existingEmployee = await prismaClient.employee.findFirst({
        where: { mobile },
        select: { employeeId: true },
      })

      if (existingEmployee) {
        const linkedUser = await prismaClient.appUser.findFirst({
          where: {
            employeeRefId: existingEmployee.employeeId,
            id: { not: currentUser.id },
          },
          select: { id: true },
        })

        if (linkedUser) {
          return NextResponse.json(
            { error: "Mobile is already mapped to another account. Use a different mobile number." },
            { status: 409 }
          )
        }

        employeeRefId = existingEmployee.employeeId
      } else {
        const employeeCreateData: Record<string, unknown> = {
          empName: currentUser.name,
          idNumber: idNumber || generateEmployeeIdNumber(),
          mobile,
          phoneNumber: mobile,
          address,
          designation,
          salaryPerday: 0,
          startDate: null,
          isTechnician: currentUser.role === "technician",
          isAttendanceEligible: !isAdminLikeDesignation(designation),
        }

        const createdEmployee = await prismaClient.employee.create({
          data: employeeCreateData,
          select: { employeeId: true },
        })

        employeeRefId = createdEmployee.employeeId
      }
    }

    await prismaClient.appUser.update({
      where: { id: currentUser.id },
      data: {
        mobile,
        phoneNumber: mobile,
        idNumber,
        address,
        employeeRefId,
      },
    })

    return NextResponse.json({ success: true, employeeRefId })
  } catch (error) {
    console.error("[AUTH_COMPLETE_PROFILE_POST]", error)
    const debugMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Failed to complete profile",
        details: process.env.NODE_ENV !== "production" ? debugMessage : undefined,
      },
      { status: 500 }
    )
  }
}
