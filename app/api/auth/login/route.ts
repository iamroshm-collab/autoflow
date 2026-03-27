import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSessionForUser, setSessionCookie } from "@/lib/auth-session"
import { createRoleNotifications } from "@/lib/app-notifications"
import { getClientIpAddress } from "@/lib/request-client"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

const prismaClient = prisma as any

const hasUnknownPrismaArgument = (error: unknown, fieldName: string) => {
  const message = error instanceof Error ? error.message : ""
  return message.includes(`Unknown argument \`${fieldName}\``)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const mobile = normalizeMobileNumber(body?.mobile)
    const resumeApprovedDevice = Boolean(body?.resumeApprovedDevice)
    const deviceId = String(body?.deviceId || "").trim().slice(0, 120)
    const deviceIp = getClientIpAddress(request)

    if (!mobile || !isValidMobileNumber(mobile) || !deviceId) {
      return NextResponse.json({ error: "Mobile and deviceId are required" }, { status: 400 })
    }

    const user = await prismaClient.appUser.findFirst({ where: { mobile } })

    if (!user) {
      return NextResponse.json({ error: "No approved user found with this mobile number." }, { status: 404 })
    }

    // Admins must use /api/auth/admin-login, not this employee path
    if (String(user.role || "").toLowerCase() === "admin") {
      return NextResponse.json(
        { error: "Admin accounts must use the admin login page." },
        { status: 403 }
      )
    }

    if (String(user.approvalStatus || "").toLowerCase() === "otp_pending") {
      return NextResponse.json(
        { error: "Verify your registration OTP before admin approval." },
        { status: 403 }
      )
    }

    if (user.approvalStatus !== "approved") {
      return NextResponse.json(
        { error: "Your account is waiting for admin approval." },
        { status: 403 }
      )
    }

    const userRole = String(user.role || "").trim().toLowerCase()
    const approvedDeviceId = String((user as any).approvedDeviceId || "").trim()
    const pendingDeviceId = String((user as any).pendingDeviceId || "").trim()
    const deviceApprovalStatus = String((user as any).deviceApprovalStatus || "none").trim().toLowerCase()

    if (userRole !== "admin") {
      const deviceAlreadyApproved = approvedDeviceId && approvedDeviceId === deviceId

      if (!deviceAlreadyApproved) {
        const alreadyPendingForThisDevice = pendingDeviceId === deviceId && deviceApprovalStatus === "pending"

        if (!alreadyPendingForThisDevice) {
          const pendingUpdate: Record<string, unknown> = {
            pendingDeviceId: deviceId,
            pendingDeviceIp: deviceIp,
            deviceApprovalStatus: "pending",
          }

          try {
            await prismaClient.appUser.update({
              where: { id: user.id },
              data: pendingUpdate,
            })
          } catch (updateError) {
            const hasUnknownDeviceFields =
              hasUnknownPrismaArgument(updateError, "pendingDeviceId") ||
              hasUnknownPrismaArgument(updateError, "pendingDeviceIp") ||
              hasUnknownPrismaArgument(updateError, "deviceApprovalStatus")

            if (!hasUnknownDeviceFields) {
              throw updateError
            }
          }

          try {
            await createRoleNotifications(["admin"], {
              title: "New Device Approval Required",
              body: `${user.name} requested login from a new device and needs approval.`,
              url: "/approvals",
              type: "device_approval_request",
            })
          } catch (notificationError) {
            console.warn("[AUTH_LOGIN_DEVICE_NOTIFICATION_FAILED]", notificationError)
          }
        }

        const errorMessage = approvedDeviceId
          ? "This device is not approved. Wait for admin approval before logging in."
          : "Your first device login request is sent to admin. Wait for approval before logging in."

        return NextResponse.json(
          {
            error: errorMessage,
            approvalStatus: "device_pending",
          },
          { status: 403 }
        )
      }
    }

    if (!resumeApprovedDevice) {
      return NextResponse.json(
        { error: "Use approved-device login flow." },
        { status: 400 }
      )
    }

    const { token, expiresAt } = await createSessionForUser(user.id)
    await prismaClient.appUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        approvedDeviceId: deviceId,
        approvedDeviceIp: deviceIp,
      },
    })

    if (Number.isInteger(user.employeeRefId)) {
      try {
        await prismaClient.employee.update({
          where: { employeeId: Number(user.employeeRefId) },
          data: {
            registeredDeviceId: deviceId,
            registeredDeviceIp: deviceIp,
            deviceRegisteredAt: new Date(),
          },
        })
      } catch (employeeDeviceUpdateError) {
        const hasLegacyDeviceFields =
          hasUnknownPrismaArgument(employeeDeviceUpdateError, "registeredDeviceId") ||
          hasUnknownPrismaArgument(employeeDeviceUpdateError, "registeredDeviceIp") ||
          hasUnknownPrismaArgument(employeeDeviceUpdateError, "deviceRegisteredAt")

        if (!hasLegacyDeviceFields) {
          throw employeeDeviceUpdateError
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      resumed: true,
      profileIncomplete: false,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        employeeRefId: user.employeeRefId,
      },
    })

    setSessionCookie(response, token, expiresAt)
    return response
  } catch (error) {
    console.error("[AUTH_LOGIN_POST]", error)
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}
