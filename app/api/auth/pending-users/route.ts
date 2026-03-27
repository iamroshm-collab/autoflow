import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

const hasUnknownPrismaArgument = (error: unknown, fieldName: string) => {
  const message = error instanceof Error ? error.message : ""
  return message.includes(`Unknown argument \`${fieldName}\``)
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (currentUser.role !== "admin" && currentUser.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let requests
    let deviceRequests: any[] = []
    let activeDevices: any[] = []
    try {
      requests = await prismaClient.appUser.findMany({
        where: {
          approvalStatus: "pending",
          role: currentUser.role === "admin" ? { in: ["manager", "technician"] } : "technician",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          mobile: true,
          role: true,
          address: true,
          designation: true,
          idNumber: true,
          approvalStatus: true,
          createdAt: true,
        },
      })

      if (currentUser.role === "admin") {
        deviceRequests = await prismaClient.appUser.findMany({
          where: {
            approvalStatus: "approved",
            role: { in: ["manager", "technician"] },
            deviceApprovalStatus: "pending",
            pendingDeviceId: { not: null },
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            mobile: true,
            role: true,
            employeeRefId: true,
            approvedDeviceId: true,
            approvedDeviceIp: true,
            pendingDeviceId: true,
            pendingDeviceIp: true,
            updatedAt: true,
          },
        })

        activeDevices = await prismaClient.appUser.findMany({
          where: {
            approvalStatus: "approved",
            role: { in: ["manager", "technician"] },
            approvedDeviceId: { not: null },
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            mobile: true,
            role: true,
            employeeRefId: true,
            approvedDeviceId: true,
            approvedDeviceIp: true,
            updatedAt: true,
          },
        })
      }
    } catch (error) {
      const hasKnownSchemaGap =
        hasUnknownPrismaArgument(error, "deviceApprovalStatus") ||
        hasUnknownPrismaArgument(error, "pendingDeviceId") ||
        hasUnknownPrismaArgument(error, "approvedDeviceId")

      if (!hasKnownSchemaGap) {
        throw error
      }

      requests = await prismaClient.appUser.findMany({
        where: {
          approvalStatus: "pending",
          role: currentUser.role === "admin" ? { in: ["manager", "technician"] } : "technician",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          mobile: true,
          role: true,
          address: true,
          designation: true,
          idNumber: true,
          approvalStatus: true,
          createdAt: true,
        },
      })
    }

    return NextResponse.json({ requests, deviceRequests, activeDevices })
  } catch (error) {
    console.error("[AUTH_PENDING_USERS_GET]", error)
    return NextResponse.json({ error: "Failed to fetch pending users" }, { status: 500 })
  }
}
