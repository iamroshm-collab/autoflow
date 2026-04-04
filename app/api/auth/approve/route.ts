import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { createUserNotification, removeNotificationsByRef } from "@/lib/app-notifications"
import { isAdminLikeDesignation } from "@/lib/attendance"
import { composeAddress } from "@/lib/address-utils"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"
import { sendApprovalResultNotification, sendApprovalResultNotificationByEmail } from "@/services/notificationService"
import { sendMetaWhatsappLoginApproved } from "@/lib/meta-whatsapp"

const prismaClient = prisma as any

const generateEmployeeIdNumber = () => {
  const stamp = Date.now().toString().slice(-8)
  const random = Math.floor(Math.random() * 900 + 100)
  return `AUTO-${stamp}${random}`
}

const hasUnknownPrismaArgument = (error: unknown, fieldName: string) => {
  const message = error instanceof Error ? error.message : ""
  return message.includes(`Unknown argument \`${fieldName}\``)
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "admin" && currentUser.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const userId = String(body?.userId || "").trim()
    const action = String(body?.action || "").trim().toLowerCase()
    const accessRoleRaw = String(body?.accessRole || "").trim().toLowerCase()
    const validRoles = ["technician", "supervisor", "manager", "accountant", "office-staff"]
    const approvedAccessRole = validRoles.includes(accessRoleRaw) ? accessRoleRaw : ""
    const profile = {
      mobile: normalizeMobileNumber(body?.mobile),
      idNumber: String(body?.idNumber || "").replace(/\D/g, "").trim(),
      designation: String(body?.designation || "").trim(),
      facePhotoUrl: String(body?.facePhotoUrl || "").trim(),
      addressLine1: String(body?.addressLine1 || "").trim(),
      addressLine2: String(body?.addressLine2 || "").trim(),
      city: String(body?.city || "").trim(),
      district: String(body?.district || "").trim(),
      state: String(body?.state || "").trim(),
      postalCode: String(body?.postalCode || "").trim(),
    }
    const composedAddress = composeAddress({
      line1: profile.addressLine1,
      line2: profile.addressLine2,
      city: profile.city,
      district: profile.district,
      state: profile.state,
      postalCode: profile.postalCode,
    })

    const isDeviceAction = action === "approve-device" || action === "deregister-device"

    if (!userId || (action !== "approve" && action !== "reject" && !isDeviceAction)) {
      return NextResponse.json({ error: "Invalid approval payload" }, { status: 400 })
    }

    if (isDeviceAction && currentUser.role !== "admin") {
      return NextResponse.json({ error: "Only admin can manage device approvals" }, { status: 403 })
    }

    if (action === "approve" && !approvedAccessRole) {
      return NextResponse.json(
        { error: "Please select a role before approval." },
        { status: 400 }
      )
    }

    if (action === "approve" && approvedAccessRole !== "customer" && !profile.designation) {
      return NextResponse.json(
        { error: "Please select a designation before approval." },
        { status: 400 }
      )
    }

    if (action === "approve" && approvedAccessRole !== "customer" && !profile.facePhotoUrl) {
      return NextResponse.json(
        { error: "Please capture a live employee photo before approval." },
        { status: 400 }
      )
    }

    const target = await prismaClient.appUser.findUnique({ where: { id: userId } })
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (isDeviceAction) {
      if (target.approvalStatus !== "approved") {
        return NextResponse.json({ error: "User account must be approved before device actions" }, { status: 400 })
      }

      const targetRole = String(target.role || "").toLowerCase()
      const hasEmployeeProfile = Number.isInteger(target.employeeRefId)

      // Customers and other non-employee roles do not require an employee profile for device management
      if (!hasEmployeeProfile && targetRole !== "customer") {
        return NextResponse.json({ error: "User is not linked to an employee profile" }, { status: 400 })
      }

      if (action === "deregister-device") {
        const deviceResetUpdate = {
          approvedDeviceId: null,
          approvedDeviceIp: null,
          pendingDeviceId: null,
          pendingDeviceIp: null,
          requestedDeviceId: null,
          requestedDeviceIp: null,
          deviceApprovalStatus: "none",
          approvedById: currentUser.id,
          approvedAt: new Date(),
        }

        await prismaClient.appUser.update({
          where: { id: target.id },
          data: deviceResetUpdate,
        })

        if (hasEmployeeProfile) {
          await prismaClient.employee.update({
            where: { employeeId: Number(target.employeeRefId) },
            data: {
              registeredDeviceId: null,
              registeredDeviceIp: null,
              deviceRegisteredAt: null,
            },
          })
        }

        try {
          await createUserNotification(target.id, {
            title: "Device Access Reset",
            body: "Your device was de-registered by admin. Log in from a device and wait for new approval.",
            url: "/login",
            type: "device_deregistered",
          })
        } catch (notificationError) {
          console.error("[AUTH_APPROVE_DEREGISTER_NOTIFY]", notificationError)
        }

        return NextResponse.json({ success: true })
      }

      const pendingDeviceId = String((target as any).pendingDeviceId || (target as any).requestedDeviceId || "").trim()
      const pendingDeviceIpRaw = String((target as any).pendingDeviceIp || (target as any).requestedDeviceIp || "").trim()

      if (!pendingDeviceId) {
        return NextResponse.json({ error: "No pending device request found for this user" }, { status: 400 })
      }

      const pendingDeviceIp = pendingDeviceIpRaw || null

      await prismaClient.appUser.update({
        where: { id: target.id },
        data: {
          approvedDeviceId: pendingDeviceId,
          approvedDeviceIp: pendingDeviceIp,
          pendingDeviceId: null,
          pendingDeviceIp: null,
          requestedDeviceId: null,
          requestedDeviceIp: null,
          deviceApprovalStatus: "none",
          approvedById: currentUser.id,
          approvedAt: new Date(),
        },
      })

      if (hasEmployeeProfile) {
        await prismaClient.employee.update({
          where: { employeeId: Number(target.employeeRefId) },
          data: {
            registeredDeviceId: pendingDeviceId,
            registeredDeviceIp: pendingDeviceIp,
            deviceRegisteredAt: new Date(),
          },
        })
      }

      try {
        // Remove the original device-approval-request notification from admins
        await removeNotificationsByRef("device_approval_request", target.id, { roles: ["admin"] })
      } catch (notificationError) {
        console.error("[AUTH_APPROVE_DEVICE_REMOVE_NOTIF]", notificationError)
      }

      try {
        await createUserNotification(target.id, {
          title: "Device Approved",
          body: "Your device is approved. You can now log in from this device.",
          url: "/login",
          type: "device_approved",
        })
      } catch (notificationError) {
        console.error("[AUTH_APPROVE_DEVICE_NOTIFY]", notificationError)
      }

      return NextResponse.json({ success: true })
    }

    if (currentUser.role === "manager" && approvedAccessRole && approvedAccessRole !== "technician") {
      return NextResponse.json({ error: "Manager can only approve technicians" }, { status: 403 })
    }

    if (currentUser.role === "manager" && !approvedAccessRole && target.role !== "technician" && target.role !== "customer") {
      return NextResponse.json({ error: "Manager can only approve technicians" }, { status: 403 })
    }

    const approvalStatus = action === "approve" ? "approved" : "rejected"

    // Map the human-readable accessRole to the stored app role
    const roleMapping: Record<string, string> = {
      technician: "technician",
      supervisor: "supervisor",
      accountant: "accountant",
      "office-staff": "office_staff",
      manager: "manager",
      customer: "customer",
    }
    const mappedAppRole = roleMapping[approvedAccessRole] ?? "manager"

    // Customers skip all employee profile requirements
    const isCustomerApproval = approvedAccessRole === "customer" || target.role === "customer"

    let approvedEmployeeId: number | null = target.employeeRefId ?? null
    const requestedDeviceId = String((target as any).requestedDeviceId || "").trim()
    const requestedDeviceIpRaw = String((target as any).requestedDeviceIp || "").trim()
    const requestedDeviceIp = requestedDeviceIpRaw || null

    if (action === "approve" && !isCustomerApproval) {
      const approvedMobile = profile.mobile || normalizeMobileNumber(target.mobile)
      const approvedDesignation = profile.designation || String(target.designation || "").trim()
      const approvedAddress = composedAddress || String(target.address || "").trim()
      const approvedIdNumber = profile.idNumber || String(target.idNumber || "").replace(/\D/g, "")
      const approvedFacePhotoUrl = profile.facePhotoUrl
      const shouldBeTechnician = mappedAppRole === "technician"

      if (!approvedMobile || !approvedDesignation || !approvedAddress || !approvedFacePhotoUrl) {
        return NextResponse.json(
          { error: "Mobile, designation, complete address, and employee photo are required for approval" },
          { status: 400 }
        )
      }

      if (!isValidMobileNumber(approvedMobile)) {
        return NextResponse.json({ error: "Mobile must be exactly 10 digits" }, { status: 400 })
      }

      if (approvedIdNumber && !/^\d{12}$/.test(approvedIdNumber)) {
        return NextResponse.json({ error: "Aadhaar ID must be exactly 12 digits" }, { status: 400 })
      }

      const existingEmployee = await prismaClient.employee.findFirst({
        where: {
          mobile: approvedMobile,
        },
        select: {
          employeeId: true,
        },
      })

      if (existingEmployee) {
        const linkedUser = await prismaClient.appUser.findFirst({
          where: {
            employeeRefId: existingEmployee.employeeId,
            id: { not: target.id },
          },
          select: {
            id: true,
          },
        })

        if (linkedUser) {
          return NextResponse.json(
            { error: "Mobile is already mapped to another approved account. Use a different mobile number." },
            { status: 409 }
          )
        }

        approvedEmployeeId = existingEmployee.employeeId

        const employeeUpdateData: Record<string, unknown> = {
          empName: target.name,
          idNumber: approvedIdNumber || generateEmployeeIdNumber(),
          mobile: approvedMobile,
          address: approvedAddress,
          designation: approvedDesignation,
          facePhotoUrl: approvedFacePhotoUrl,
          facePhotoUpdatedAt: new Date(),
          isTechnician: shouldBeTechnician,
          isAttendanceEligible: !isAdminLikeDesignation(approvedDesignation),
        }

        try {
          await prismaClient.employee.update({
            where: { employeeId: existingEmployee.employeeId },
            data: employeeUpdateData,
          })
        } catch (updateEmployeeError) {
          const hasLegacyEmployeeFields =
            hasUnknownPrismaArgument(updateEmployeeError, "isTechnician") ||
            hasUnknownPrismaArgument(updateEmployeeError, "isAttendanceEligible") ||
            hasUnknownPrismaArgument(updateEmployeeError, "facePhotoUrl") ||
            hasUnknownPrismaArgument(updateEmployeeError, "facePhotoUpdatedAt")

          if (!hasLegacyEmployeeFields) {
            throw updateEmployeeError
          }

          const fallbackEmployeeUpdateData = { ...employeeUpdateData }
          if (hasLegacyEmployeeFields) {
            delete fallbackEmployeeUpdateData.isTechnician
            delete fallbackEmployeeUpdateData.isAttendanceEligible
            delete fallbackEmployeeUpdateData.facePhotoUrl
            delete fallbackEmployeeUpdateData.facePhotoUpdatedAt
          }

          await prismaClient.employee.update({
            where: { employeeId: existingEmployee.employeeId },
            data: fallbackEmployeeUpdateData,
          })
        }
      } else {
        const employeeCreateData: Record<string, unknown> = {
          empName: target.name,
          idNumber: approvedIdNumber || generateEmployeeIdNumber(),
          mobile: approvedMobile,
          address: approvedAddress,
          designation: approvedDesignation,
          facePhotoUrl: approvedFacePhotoUrl,
          facePhotoUpdatedAt: new Date(),
          salaryPerday: 0,
          startDate: null,
          isTechnician: shouldBeTechnician,
          isAttendanceEligible: !isAdminLikeDesignation(approvedDesignation),
        }

        let createdEmployee
        try {
          createdEmployee = await prismaClient.employee.create({
            data: employeeCreateData,
            select: {
              employeeId: true,
            },
          })
        } catch (createEmployeeError) {
          const hasLegacyEmployeeFields =
            hasUnknownPrismaArgument(createEmployeeError, "isTechnician") ||
            hasUnknownPrismaArgument(createEmployeeError, "isAttendanceEligible") ||
            hasUnknownPrismaArgument(createEmployeeError, "facePhotoUrl") ||
            hasUnknownPrismaArgument(createEmployeeError, "facePhotoUpdatedAt")

          if (!hasLegacyEmployeeFields) {
            throw createEmployeeError
          }

          const fallbackEmployeeCreateData = { ...employeeCreateData }
          if (hasLegacyEmployeeFields) {
            delete fallbackEmployeeCreateData.isTechnician
            delete fallbackEmployeeCreateData.isAttendanceEligible
            delete fallbackEmployeeCreateData.facePhotoUrl
            delete fallbackEmployeeCreateData.facePhotoUpdatedAt
          }

          createdEmployee = await prismaClient.employee.create({
            data: fallbackEmployeeCreateData,
            select: {
              employeeId: true,
            },
          })
        }

        approvedEmployeeId = createdEmployee.employeeId
      }
    }

    const userUpdateData: Record<string, unknown> = {
      approvalStatus,
      approvedById: currentUser.id,
      approvedAt: new Date(),
      ...(action === "approve"
        ? {
            role: mappedAppRole,
            approvedDeviceId: requestedDeviceId || null,
            approvedDeviceIp: requestedDeviceIp,
            pendingDeviceId: null,
            pendingDeviceIp: null,
            deviceApprovalStatus: "none",
            // Employee-specific fields only for non-customer approvals
            ...(!isCustomerApproval
              ? {
                  mobile: profile.mobile || target.mobile,
                  address: composedAddress || target.address,
                  designation: profile.designation || target.designation,
                  idNumber: profile.idNumber || target.idNumber,
                }
              : {}),
          }
        : {}),
      ...(action === "approve" && !isCustomerApproval ? { employeeRefId: approvedEmployeeId } : {}),
    }

    if (action === "approve" && approvedEmployeeId) {
      try {
        await prismaClient.employee.update({
          where: { employeeId: approvedEmployeeId },
          data: {
            registeredDeviceId: requestedDeviceId || null,
            registeredDeviceIp: requestedDeviceIp,
            deviceRegisteredAt: requestedDeviceId ? new Date() : null,
          },
        })
      } catch (employeeDeviceUpdateError) {
        const hasUnknownDeviceField =
          hasUnknownPrismaArgument(employeeDeviceUpdateError, "registeredDeviceId") ||
          hasUnknownPrismaArgument(employeeDeviceUpdateError, "registeredDeviceIp") ||
          hasUnknownPrismaArgument(employeeDeviceUpdateError, "deviceRegisteredAt")

        if (!hasUnknownDeviceField) {
          throw employeeDeviceUpdateError
        }
      }
    }

    try {
      await prismaClient.appUser.update({
        where: { id: target.id },
        data: userUpdateData,
      })
    } catch (updateError) {
      // Backward compatibility: older generated Prisma clients / schemas may not have audit columns.
      const hasUnknownAuditField =
        hasUnknownPrismaArgument(updateError, "approvedById") ||
        hasUnknownPrismaArgument(updateError, "approvedAt") ||
        hasUnknownPrismaArgument(updateError, "employeeRefId") ||
        hasUnknownPrismaArgument(updateError, "approvedDeviceId") ||
        hasUnknownPrismaArgument(updateError, "approvedDeviceIp") ||
        hasUnknownPrismaArgument(updateError, "pendingDeviceId") ||
        hasUnknownPrismaArgument(updateError, "pendingDeviceIp") ||
        hasUnknownPrismaArgument(updateError, "deviceApprovalStatus")

      if (!hasUnknownAuditField) {
        throw updateError
      }

      const {
        approvedById,
        approvedAt,
        employeeRefId,
        approvedDeviceId,
        approvedDeviceIp,
        pendingDeviceId,
        pendingDeviceIp,
        deviceApprovalStatus,
        ...fallbackUpdateData
      } = userUpdateData
      void approvedById
      void approvedAt
      void employeeRefId
      void approvedDeviceId
      void approvedDeviceIp
      void pendingDeviceId
      void pendingDeviceIp
      void deviceApprovalStatus

      await prismaClient.appUser.update({
        where: { id: target.id },
        data: fallbackUpdateData,
      })
    }

    try {
      // Remove the original access-request notification from admins/managers now that it's resolved
      await removeNotificationsByRef("access_request", target.id, { roles: ["admin", "manager"] })
    } catch (notificationError) {
      console.error("[AUTH_APPROVE_REMOVE_ACCESS_NOTIF]", notificationError)
    }

    try {
      await createUserNotification(target.id, {
        title: action === "approve" ? "Registration Approved" : "Registration Rejected",
        body: action === "approve"
          ? "Your account is approved. You can now log in directly from your approved device."
          : "Your registration request was rejected. Contact admin.",
        url: "/login",
        type: "approval_result",
      })
    } catch (notificationError) {
      console.error("[AUTH_APPROVE_APP_NOTIFICATION]", notificationError)
    }

    if (approvedEmployeeId) {
      try {
        await sendApprovalResultNotification(
          approvedEmployeeId,
          { status: action === "approve" ? "approved" : "rejected" },
          request.nextUrl.origin
        )
      } catch (pushError) {
        console.error("[AUTH_APPROVE_PUSH_NOTIFICATION]", pushError)
      }
    }

    try {
      await sendApprovalResultNotificationByEmail(
        String(target.mobile || ""),
        { status: action === "approve" ? "approved" : "rejected" },
        request.nextUrl.origin
      )
    } catch (aliasPushError) {
      console.error("[AUTH_APPROVE_ALIAS_PUSH_NOTIFICATION]", aliasPushError)
    }

    // Send WhatsApp login_approved template when account is approved
    if (action === "approve") {
      try {
        const approvedMobile = String(profile.mobile || target.mobile || "").replace(/\D/g, "").slice(-10)
        const approvedName = String(target.name || "").trim()
        if (approvedMobile.length === 10 && approvedName) {
          await sendMetaWhatsappLoginApproved(approvedMobile, approvedName)
        }
      } catch (whatsappError) {
        console.error("[AUTH_APPROVE_WHATSAPP_NOTIFY]", whatsappError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[AUTH_APPROVE_POST]", error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "This user is already linked to an employee profile. Refresh and try again." },
          { status: 409 }
        )
      }
    }

    const debugMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Failed to process approval",
        details: process.env.NODE_ENV !== "production" ? debugMessage : undefined,
      },
      { status: 500 }
    )
  }
}
