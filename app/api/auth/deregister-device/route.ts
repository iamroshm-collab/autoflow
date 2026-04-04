import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"
import { requestWhatsappOtp, verifyWhatsappOtp } from "@/lib/whatsapp-otp"

const prismaClient = prisma as any

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const mobile = normalizeMobileNumber(body?.mobile)
    const otp = String(body?.otp || "").trim()
    const verifyOtp = Boolean(body?.verifyOtp)

    if (!mobile || !isValidMobileNumber(mobile)) {
      return NextResponse.json({ error: "Valid mobile number is required" }, { status: 400 })
    }

    const user = await prismaClient.appUser.findFirst({
      where: { mobile },
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        role: true,
        approvedDeviceId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "No account found with this mobile number." }, { status: 404 })
    }

    if (user.approvalStatus !== "approved") {
      return NextResponse.json({ error: "Account is not yet approved." }, { status: 403 })
    }

    if (String(user.role || "").toLowerCase() === "admin") {
      return NextResponse.json({ error: "Admin accounts cannot use self-service device reset." }, { status: 403 })
    }

    if (!String(user.approvedDeviceId || "").trim()) {
      return NextResponse.json({ error: "No approved device found on this account." }, { status: 400 })
    }

    // ── Phase 1: request OTP ─────────────────────────────────────────────────
    if (!verifyOtp) {
      await requestWhatsappOtp({
        userId: user.id,
        mobile,
        purpose: "login",
      })

      return NextResponse.json({
        success: true,
        otpSent: true,
        message: "OTP sent to your WhatsApp. Enter it to confirm device de-registration.",
      })
    }

    // ── Phase 2: verify OTP and clear device ─────────────────────────────────
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "6-digit OTP is required" }, { status: 400 })
    }

    await verifyWhatsappOtp({
      userId: user.id,
      mobile,
      purpose: "login",
      otp,
    })

    // Clear all device fields — keep everything else (role, data, approvalStatus) intact
    const deviceClearData: Record<string, unknown> = {
      approvedDeviceId: null,
      approvedDeviceIp: null,
      pendingDeviceId: null,
      pendingDeviceIp: null,
      deviceApprovalStatus: "none",
    }

    try {
      await prismaClient.appUser.update({
        where: { id: user.id },
        data: deviceClearData,
      })
    } catch (updateError: unknown) {
      const msg = updateError instanceof Error ? updateError.message : ""
      const isUnknownField =
        msg.includes("Unknown argument `approvedDeviceId`") ||
        msg.includes("Unknown argument `pendingDeviceId`") ||
        msg.includes("Unknown argument `deviceApprovalStatus`")
      if (!isUnknownField) throw updateError
      // Older schema — skip device fields silently
    }

    // Also clear the registered device from the employee record if linked
    if (Number.isInteger(user.employeeRefId)) {
      try {
        await prismaClient.employee.update({
          where: { employeeId: Number(user.employeeRefId) },
          data: {
            registeredDeviceId: null,
            registeredDeviceIp: null,
            deviceRegisteredAt: null,
          },
        })
      } catch {
        // Non-critical — employee table may not have these fields yet
      }
    }

    return NextResponse.json({
      success: true,
      message: "Old device de-registered. You can now log in from this device and wait for admin approval.",
    })
  } catch (error) {
    console.error("[DEREGISTER_DEVICE_POST]", error)
    const msg = error instanceof Error ? error.message : ""
    // Surface OTP-specific errors clearly
    if (msg.toLowerCase().includes("otp") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
      return NextResponse.json({ error: msg || "Invalid or expired OTP" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to de-register device" }, { status: 500 })
  }
}
