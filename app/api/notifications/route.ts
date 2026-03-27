import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 30), 100)
    const includeRead = request.nextUrl.searchParams.get("includeRead") === "true"

    const notifications = await prismaClient.appNotification.findMany({
      where: {
        ...(includeRead ? {} : { isRead: false }),
        OR: [
          { targetUserId: user.id },
          { targetRole: user.role },
          { targetRole: "all" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        url: true,
        targetForm: true,
        isRead: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const mode = request.nextUrl.searchParams.get("mode") || "read"

    const baseWhere = {
      OR: [
        { targetUserId: user.id },
        { targetRole: user.role },
        { targetRole: "all" },
      ],
    }

    const where = mode === "all"
      ? baseWhere
      : {
          ...baseWhere,
          isRead: true,
        }

    const deleted = await prismaClient.appNotification.deleteMany({ where })

    return NextResponse.json({ success: true, deletedCount: deleted.count })
  } catch (error) {
    console.error("[NOTIFICATIONS_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 })
  }
}
