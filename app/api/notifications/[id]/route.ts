import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

const prismaClient = prisma as any

const getAllowedNotification = async (id: string, user: any) => {
  const current = await prismaClient.appNotification.findUnique({ where: { id } })
  if (!current) {
    return { current: null, allowed: false }
  }

  const allowed =
    current.targetUserId === user.id ||
    current.targetRole === user.role ||
    current.targetRole === "all"

  return { current, allowed }
}

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
    const { current, allowed } = await getAllowedNotification(id, user)

    if (!current) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prismaClient.appNotification.update({
      where: { id },
      data: { isRead: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[NOTIFICATION_PATCH]", error)
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { current, allowed } = await getAllowedNotification(id, user)

    if (!current) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prismaClient.appNotification.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[NOTIFICATION_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 })
  }
}
