import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidRole } from "@/lib/access-control"
import { createRoleNotifications } from "@/lib/app-notifications"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"
import { requestWhatsappOtp, verifyWhatsappOtp } from "@/lib/whatsapp-otp"
import { getClientIpAddress } from "@/lib/request-client"

const prismaClient = prisma as any

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const verifyOtpOnly = Boolean(body?.verifyOtpOnly)
    const name = String(body?.name || "").trim()
    const addressRaw = String(body?.address || "").trim()
    const addressLine1 = String(body?.addressLine1 || "").trim()
    const addressLine2 = String(body?.addressLine2 || "").trim()
    const city = String(body?.city || "").trim()
    const state = String(body?.state || "").trim()
    const postalCode = String(body?.postalCode || "").trim()
    const address = addressRaw || [addressLine1, addressLine2, city, state, postalCode].filter(Boolean).join(", ")
    const mobile = normalizeMobileNumber(body?.mobile)
    const otp = String(body?.otp || "").trim()
    const roleRaw = String(body?.role || "technician").trim().toLowerCase().replace(/-/g, "_")
    const requestedDeviceId = String(body?.deviceId || "").trim().slice(0, 120)
    const requestedDeviceIp = getClientIpAddress(request)
    const aadhar = String(body?.aadhar || "").replace(/\D/g, "").slice(0, 12) || null

    if (verifyOtpOnly) {
      if (!mobile || !/^\d{6}$/.test(otp)) {
        return NextResponse.json({ error: "Mobile and 6-digit OTP are required" }, { status: 400 })
      }

      const existing = await prismaClient.appUser.findFirst({
        where: { mobile },
        select: { id: true, approvalStatus: true, name: true },
      })

      if (!existing) {
        return NextResponse.json({ error: "No pending registration found for this mobile number." }, { status: 404 })
      }

      await verifyWhatsappOtp({
        userId: existing.id,
        mobile,
        purpose: "register",
        otp,
      })

      if (existing.approvalStatus === "otp_pending") {
        await prismaClient.appUser.update({
          where: { id: existing.id },
          data: { approvalStatus: "pending" },
        })

        try {
          await createRoleNotifications(["admin"], {
            title: "Registration Approval Required",
            body: `${existing.name || "Unknown"} (${mobile}) is waiting for registration approval`,
            url: "/approvals",
            type: "approval_request",
            refType: "access_request",
            refId: existing.id,
          })
        } catch (notificationError) {
          console.warn("[AUTH_REGISTER_NOTIFICATION_FAILED]", notificationError)
        }
      }

      return NextResponse.json({
        success: true,
        message: "Mobile verified. Your request is now submitted for admin approval.",
      })
    }

    if (
      !name
      || !isValidMobileNumber(mobile)
      || !isValidRole(roleRaw)
      || !address
      || !/^\d{12}$/.test(aadhar || "")
    ) {
      return NextResponse.json(
        { error: "Name, address, WhatsApp number and 12-digit Aadhar are required." },
        { status: 400 }
      )
    }

    const role = roleRaw

    if (role === "admin" || role === "manager") {
      return NextResponse.json(
        { error: "Admin and manager registration is disabled. Contact your administrator." },
        { status: 403 }
      )
    }

    const existing = await prismaClient.appUser.findFirst({
      where: { mobile },
      select: { id: true, approvalStatus: true },
    })
    const canResubmitRejected = existing?.approvalStatus === "rejected" || existing?.approvalStatus === "otp_pending"
    if (existing && !canResubmitRejected) {
      const errorMessage = existing.approvalStatus === "pending"
        ? "Your registration is already submitted and waiting for admin approval."
        : "This mobile is already approved. Please login from your approved device."
      return NextResponse.json({ error: errorMessage }, { status: 409 })
    }

    const isAutoApproved = false
    const buildUserData = async () => ({
      name,
      role,
      mobile,
      phoneNumber: mobile,
      address,
      idNumber: aadhar,
      designation: null,
      approvalStatus: isAutoApproved ? "approved" : "otp_pending",
      approvedById: null,
      approvedAt: null,
      requestedDeviceId: requestedDeviceId || null,
      requestedDeviceIp,
      pendingDeviceId: null,
      pendingDeviceIp: null,
      approvedDeviceId: null,
      approvedDeviceIp: null,
      deviceApprovalStatus: "none",
    })

    let user
    if (canResubmitRejected) {
      const userData = await buildUserData()
      user = await prismaClient.appUser.update({
        where: { id: existing.id },
        data: userData,
        select: {
          id: true,
          name: true,
          mobile: true,
          role: true,
          approvalStatus: true,
        },
      })
    } else {
      const userData = await buildUserData()
      user = await prismaClient.appUser.create({
        data: userData,
        select: {
          id: true,
          name: true,
          mobile: true,
          role: true,
          approvalStatus: true,
        },
      })
    }

    await requestWhatsappOtp({
      userId: user.id,
      mobile,
      purpose: "register",
    })

    return NextResponse.json({
      success: true,
      approvalStatus: user.approvalStatus,
      message: "Registration OTP sent on WhatsApp. Verify OTP before your request reaches admin dashboard.",
    })
  } catch (error) {
    console.error("[AUTH_REGISTER_POST]", error)
    const debugMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        error: "Failed to register",
        details: process.env.NODE_ENV !== "production" ? debugMessage : undefined,
      },
      { status: 500 }
    )
  }
}
