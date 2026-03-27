import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminBootstrapStatus, validateAdminBootstrapKey } from "@/lib/admin-bootstrap"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

const prismaClient = prisma as any

const hasUnknownPrismaArgument = (error: unknown, fieldName: string) => {
  const message = error instanceof Error ? error.message : ""
  return message.includes(`Unknown argument \`${fieldName}\``)
}

export async function POST(request: NextRequest) {
  try {
    const bootstrapStatus = getAdminBootstrapStatus()

    if (!bootstrapStatus.enabledByEnv) {
      return NextResponse.json(
        { error: "Admin bootstrap is disabled. Set ADMIN_BOOTSTRAP_ENABLED=true to use this endpoint." },
        { status: 403 }
      )
    }

    if (bootstrapStatus.productionBlocked) {
      return NextResponse.json(
        { error: "Admin bootstrap is blocked in production. Set ADMIN_BOOTSTRAP_ALLOW_IN_PRODUCTION=true only for controlled setup windows." },
        { status: 403 }
      )
    }

    if (bootstrapStatus.locked) {
      return NextResponse.json(
        { error: "Admin bootstrap is locked at runtime. Unlock is not supported; deploy with bootstrap disabled." },
        { status: 403 }
      )
    }

    if (!bootstrapStatus.hasSetupKey) {
      return NextResponse.json(
        { error: "Server is missing ADMIN_BOOTSTRAP_KEY configuration." },
        { status: 500 }
      )
    }

    const body = await request.json()
    const providedKey = String(body?.setupKey || "").trim()
    const name = String(body?.name || "").trim()
    const mobile = normalizeMobileNumber(body?.mobile)

    const keyValidation = validateAdminBootstrapKey(providedKey)
    if (!keyValidation.ok) {
      return NextResponse.json({ error: "Invalid setup key." }, { status: 401 })
    }

    if (!name || !mobile) {
      return NextResponse.json({ error: "Name and mobile are required." }, { status: 400 })
    }

    if (!isValidMobileNumber(mobile)) {
      return NextResponse.json({ error: "Mobile must be exactly 10 digits." }, { status: 400 })
    }

    const existingAppUser = await prismaClient.appUser.findUnique({
      where: { mobile },
      select: { id: true },
    })

    const userData: Record<string, unknown> = {
      name,
      mobile,
      phoneNumber: mobile,
      role: "admin",
      address: null,
      idNumber: null,
      designation: "Administrator",
      approvalStatus: "approved",
      approvedById: null,
      approvedAt: new Date(),
    }

    if (existingAppUser) {
      try {
        await prismaClient.appUser.update({
          where: { id: existingAppUser.id },
          data: userData,
        })
      } catch (updateError) {
        const hasUnknownApprovalAudit =
          hasUnknownPrismaArgument(updateError, "approvedById") ||
          hasUnknownPrismaArgument(updateError, "approvedAt")

        if (!hasUnknownApprovalAudit) {
          throw updateError
        }

        const fallbackUserData = { ...userData }
        if (hasUnknownApprovalAudit) {
          delete fallbackUserData.approvedById
          delete fallbackUserData.approvedAt
        }

        await prismaClient.appUser.update({
          where: { id: existingAppUser.id },
          data: fallbackUserData,
        })
      }

      return NextResponse.json({ success: true, action: "updated" })
    }

    try {
      await prismaClient.appUser.create({
        data: userData,
      })
    } catch (createError) {
      const hasUnknownApprovalAudit =
        hasUnknownPrismaArgument(createError, "approvedById") ||
        hasUnknownPrismaArgument(createError, "approvedAt")

      if (!hasUnknownApprovalAudit) {
        throw createError
      }

      const fallbackUserData = { ...userData }
      if (hasUnknownApprovalAudit) {
        delete fallbackUserData.approvedById
        delete fallbackUserData.approvedAt
      }

      await prismaClient.appUser.create({
        data: fallbackUserData,
      })
    }

    return NextResponse.json({ success: true, action: "created" })
  } catch (error) {
    console.error("[AUTH_BOOTSTRAP_ADMIN_POST]", error)
    const debugMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        error: "Failed to bootstrap admin account",
        details: process.env.NODE_ENV !== "production" ? debugMessage : undefined,
      },
      { status: 500 }
    )
  }
}