import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const current = await prismaClient.appNotification.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    const isAllowed =
      current.targetUserId === user.id ||
      current.targetRole === user.role ||
      current.targetRole === "all"

    if (!isAllowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prismaClient.appNotification.update({
      where: { id },
      data: { isRead: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[NOTIFICATION_READ_PATCH]", error)
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}
