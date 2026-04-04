import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

interface NotificationInput {
  title: string
  body: string
  url?: string
  targetForm?: string
  type?: string
  /** Logical group type — e.g. "jobcard", "access_request", "device_approval_request" */
  refType?: string
  /** ID within that group — e.g. jobCard.id or appUser.id */
  refId?: string
}

/**
 * Create notifications for one or more roles.
 *
 * When refType === "jobcard" (or any refType + refId pair is supplied), any
 * existing notifications for the same ref and the same target roles are deleted
 * first, so only the latest notification per job card survives.
 */
export const createRoleNotifications = async (
  roles: Array<"admin" | "manager" | "technician">,
  input: NotificationInput
) => {
  if (!roles.length) return

  const { refType, refId } = input

  if (refType && refId) {
    // Delete-then-create in a transaction to avoid duplicates
    await prismaClient.$transaction(async (tx: any) => {
      await tx.appNotification.deleteMany({
        where: {
          refType,
          refId,
          targetRole: { in: roles },
          targetUserId: null,
        },
      })

      await tx.appNotification.createMany({
        data: roles.map((role) => ({
          title: input.title,
          body: input.body,
          targetRole: role,
          url: input.url || null,
          targetForm: input.targetForm || null,
          type: input.type || "info",
          refType,
          refId,
        })),
      })
    })
  } else {
    await prismaClient.appNotification.createMany({
      data: roles.map((role) => ({
        title: input.title,
        body: input.body,
        targetRole: role,
        url: input.url || null,
        targetForm: input.targetForm || null,
        type: input.type || "info",
        refType: refType || null,
        refId: refId || null,
      })),
    })
  }
}

/**
 * Create a notification for a specific user.
 *
 * When refType + refId are supplied and refType === "jobcard", any existing
 * notification for the same ref and user is deleted first.
 */
export const createUserNotification = async (
  userId: string,
  input: NotificationInput
) => {
  const { refType, refId } = input

  if (refType && refId) {
    await prismaClient.$transaction(async (tx: any) => {
      await tx.appNotification.deleteMany({
        where: { refType, refId, targetUserId: userId },
      })

      await tx.appNotification.create({
        data: {
          title: input.title,
          body: input.body,
          targetUserId: userId,
          url: input.url || null,
          targetForm: input.targetForm || null,
          type: input.type || "info",
          refType,
          refId,
        },
      })
    })
  } else {
    await prismaClient.appNotification.create({
      data: {
        title: input.title,
        body: input.body,
        targetUserId: userId,
        url: input.url || null,
        targetForm: input.targetForm || null,
        type: input.type || "info",
        refType: refType || null,
        refId: refId || null,
      },
    })
  }
}

/**
 * Remove all notifications matching a ref, scoped to specific roles and/or user IDs.
 * Used after approval/rejection to clear the original request notification.
 */
export const removeNotificationsByRef = async (
  refType: string,
  refId: string,
  recipients: { roles?: string[]; userIds?: string[] }
) => {
  const { roles = [], userIds = [] } = recipients

  const orClauses: any[] = []
  if (roles.length) orClauses.push({ targetRole: { in: roles }, targetUserId: null })
  if (userIds.length) orClauses.push({ targetUserId: { in: userIds } })

  if (!orClauses.length) return

  await prismaClient.appNotification.deleteMany({
    where: {
      refType,
      refId,
      OR: orClauses,
    },
  })
}
