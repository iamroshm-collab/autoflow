import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

interface NotificationInput {
  title: string
  body: string
  url?: string
  targetForm?: string
  type?: string
}

export const createRoleNotifications = async (
  roles: Array<"admin" | "manager" | "technician">,
  input: NotificationInput
) => {
  if (!roles.length) return

  await prismaClient.appNotification.createMany({
    data: roles.map((role) => ({
      title: input.title,
      body: input.body,
      targetRole: role,
      url: input.url || null,
      targetForm: input.targetForm || null,
      type: input.type || "info",
    })),
  })
}

export const createUserNotification = async (
  userId: string,
  input: NotificationInput
) => {
  await prismaClient.appNotification.create({
    data: {
      title: input.title,
      body: input.body,
      targetUserId: userId,
      url: input.url || null,
      targetForm: input.targetForm || null,
      type: input.type || "info",
    },
  })
}
