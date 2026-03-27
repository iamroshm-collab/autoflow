import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSessionForUser, setSessionCookie } from "@/lib/auth-session"
import { getClientIpAddress } from "@/lib/request-client"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"
import { requestWhatsappOtp, verifyWhatsappOtp } from "@/lib/whatsapp-otp"

const prismaClient = prisma as any

const getAdminMobile = () => String(process.env.ADMIN_MOBILE || "").replace(/\D/g, "").trim()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const mobile = normalizeMobileNumber(body?.mobile)
    const otp = String(body?.otp || "").trim()
    const deviceId = String(body?.deviceId || "").trim().slice(0, 120)
    const deviceIp = getClientIpAddress(request)

    const adminMobile = getAdminMobile()

    if (!adminMobile) {
      return NextResponse.json(
        { error: "Admin login is not configured on this server." },
        { status: 503 }
      )
    }

    if (!mobile || !isValidMobileNumber(mobile)) {
      return NextResponse.json({ error: "Valid 10-digit mobile number is required." }, { status: 400 })
    }

    if (mobile !== adminMobile) {
      return NextResponse.json(
        { error: "Only the registered admin mobile number is allowed to login here." },
        { status: 403 }
      )
    }

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required." }, { status: 400 })
    }

    // Find or create the admin AppUser record
    let user = await prismaClient.appUser.findFirst({ where: { mobile, role: "admin" } })

    if (!user) {
      // Also check any existing AppUser with this mobile that may have a different role
      const existingUser = await prismaClient.appUser.findFirst({ where: { mobile } })
      if (existingUser) {
        user = await prismaClient.appUser.update({
          where: { id: existingUser.id },
          data: {
            role: "admin",
            approvalStatus: "approved",
            approvedAt: new Date(),
          },
        })
      } else {
        user = await prismaClient.appUser.create({
          data: {
            name: "Admin",
            mobile,
            phoneNumber: mobile,
            role: "admin",
            approvalStatus: "approved",
            approvedAt: new Date(),
            deviceApprovalStatus: "none",
          },
        })
      }
    } else if (user.approvalStatus !== "approved") {
      await prismaClient.appUser.update({
        where: { id: user.id },
        data: { approvalStatus: "approved", approvedAt: new Date() },
      })
      user.approvalStatus = "approved"
    }

    // Check if this device is already trusted
    const trustedDevice = await prismaClient.adminTrustedDevice.findFirst({
      where: { appUserId: user.id, deviceId, isActive: true },
    })

    if (trustedDevice) {
      // Trusted device — update last used and issue session immediately without OTP
      await prismaClient.adminTrustedDevice.update({
        where: { id: trustedDevice.id },
        data: { lastUsedAt: new Date(), deviceIp },
      })

      await prismaClient.adminAuthProfile.upsert({
        where: { appUserId: user.id },
        update: { lastLoginAt: new Date(), updatedAt: new Date() },
        create: { appUserId: user.id, isActive: true, lastLoginAt: new Date() },
      })

      const { token, expiresAt } = await createSessionForUser(user.id)
      await prismaClient.appUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      const response = NextResponse.json({
        success: true,
        trustedDevice: true,
        user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role },
      })
      setSessionCookie(response, token, expiresAt)
      return response
    }

    // Not a trusted device — handle OTP flow
    if (!otp) {
      // Request OTP
      await requestWhatsappOtp({ userId: user.id, mobile, purpose: "login" })
      return NextResponse.json({
        otpSent: true,
        message: "OTP sent to your WhatsApp. Enter OTP to login.",
      })
    }

    // Verify OTP
    await verifyWhatsappOtp({ userId: user.id, mobile, purpose: "login", otp })

    // Register as trusted device
    await prismaClient.adminTrustedDevice.upsert({
      where: { appUserId_deviceId: { appUserId: user.id, deviceId } },
      update: { isActive: true, lastUsedAt: new Date(), deviceIp },
      create: {
        appUserId: user.id,
        deviceId,
        deviceIp,
        isActive: true,
      },
    })

    // Ensure AdminAuthProfile record exists
    await prismaClient.adminAuthProfile.upsert({
      where: { appUserId: user.id },
      update: { lastLoginAt: new Date(), updatedAt: new Date() },
      create: { appUserId: user.id, isActive: true, lastLoginAt: new Date() },
    })

    const { token, expiresAt } = await createSessionForUser(user.id)
    await prismaClient.appUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        approvedDeviceId: deviceId,
        approvedDeviceIp: deviceIp,
      },
    })

    const response = NextResponse.json({
      success: true,
      trustedDevice: false,
      user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role },
    })
    setSessionCookie(response, token, expiresAt)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (
      message.toLowerCase().includes("otp") ||
      message.toLowerCase().includes("expired") ||
      message.toLowerCase().includes("invalid")
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error("[ADMIN_LOGIN_POST]", error)
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 })
  }
}
