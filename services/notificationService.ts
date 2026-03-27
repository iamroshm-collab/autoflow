import { prisma } from "@/lib/prisma"

const prismaClient = prisma

const getServerOneSignalAppId = () =>
  String(process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "").trim()

const getServerOneSignalRestKey = () =>
  String(process.env.ONESIGNAL_REST_API_KEY || "").trim()

export interface NotificationPayload {
  title: string
  body: string
  url?: string
  data?: Record<string, string>
}

export interface JobAssignmentNotification {
  jobId: string
  vehicleNumber: string
  taskAssigned?: string
  customerName?: string
}

export interface JobStatusChangeNotification {
  jobId: string
  vehicleNumber?: string
  customerName?: string
}

export interface ApprovalResultNotification {
  status: "approved" | "rejected"
}

const hasOneSignalConfig = () => {
  return Boolean(
    getServerOneSignalAppId() && getServerOneSignalRestKey()
  )
}

const sendOneSignalRequest = async (playerIds: string[], payload: NotificationPayload) => {
  if (!hasOneSignalConfig()) {
    console.warn("[ONESIGNAL] Missing OneSignal configuration, skipping push send")
    return null
  }

  if (!playerIds.length) {
    return null
  }

  const baseBody = {
    app_id: getServerOneSignalAppId(),
    headings: { en: payload.title },
    contents: { en: payload.body },
    url: payload.url || undefined,
    data: payload.data || {},
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Key ${getServerOneSignalRestKey()}`,
  }

  // v16 Web SDK returns subscription IDs. Keep a fallback for older player IDs.
  const attemptBodies = [
    { ...baseBody, include_subscription_ids: playerIds },
    { ...baseBody, include_player_ids: playerIds },
  ]

  let lastErrorText = ""
  for (const body of attemptBodies) {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })

    if (response.ok) {
      return response.json()
    }

    lastErrorText = await response.text()
    const isClientError = response.status >= 400 && response.status < 500
    if (!isClientError) {
      throw new Error(`OneSignal request failed: ${response.status} ${lastErrorText}`)
    }
  }

  throw new Error(`OneSignal request failed: ${lastErrorText || "unknown error"}`)
}

const sendOneSignalRequestByExternalIds = async (externalIds: string[], payload: NotificationPayload) => {
  if (!hasOneSignalConfig()) {
    console.warn("[ONESIGNAL] Missing OneSignal configuration, skipping push send")
    return null
  }

  const normalizedExternalIds = externalIds
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)

  if (!normalizedExternalIds.length) {
    return null
  }

  const baseBody = {
    app_id: getServerOneSignalAppId(),
    headings: { en: payload.title },
    contents: { en: payload.body },
    url: payload.url || undefined,
    data: payload.data || {},
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Key ${getServerOneSignalRestKey()}`,
  }

  const attemptBodies = [
    {
      ...baseBody,
      include_aliases: { external_id: normalizedExternalIds },
      target_channel: "push",
    },
    {
      ...baseBody,
      include_external_user_ids: normalizedExternalIds,
      channel_for_external_user_ids: "push",
    },
  ]

  let lastErrorText = ""
  for (const body of attemptBodies) {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })

    if (response.ok) {
      return response.json()
    }

    lastErrorText = await response.text()
    const isClientError = response.status >= 400 && response.status < 500
    if (!isClientError) {
      throw new Error(`OneSignal request failed: ${response.status} ${lastErrorText}`)
    }
  }

  throw new Error(`OneSignal alias request failed: ${lastErrorText || "unknown error"}`)
}

export async function saveNotificationDevice(
  employeeId: number,
  oneSignalPlayerId: string
) {
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new Error("Invalid employeeId")
  }

  const normalizedPlayerId = String(oneSignalPlayerId || "").trim()
  if (!normalizedPlayerId) {
    throw new Error("OneSignal player ID is required")
  }

  const employee = await prismaClient.employee.findUnique({
    where: { employeeId },
    select: { employeeId: true },
  })

  if (!employee) {
    throw new Error("Employee not found")
  }

  const existing = await prismaClient.notificationDevice.findFirst({
    where: {
      employeeId,
      oneSignalPlayerId: normalizedPlayerId,
    },
  })

  if (existing) {
    return existing
  }

  return prismaClient.notificationDevice.upsert({
    where: { oneSignalPlayerId: normalizedPlayerId },
    update: { employeeId },
    create: {
      employeeId,
      oneSignalPlayerId: normalizedPlayerId,
    },
  })
}

export async function getEmployeePlayerIds(employeeIds: number[]) {
  if (!employeeIds.length) {
    return []
  }

  const devices = await prismaClient.notificationDevice.findMany({
    where: {
      employeeId: { in: employeeIds },
    },
    select: { oneSignalPlayerId: true },
  })

  return devices.map((device: { oneSignalPlayerId: string }) => device.oneSignalPlayerId)
}

export async function sendNotificationToEmployees(employeeIds: number[], payload: NotificationPayload) {
  const playerIds = await getEmployeePlayerIds(employeeIds)
  return sendOneSignalRequest(playerIds, payload)
}

export async function sendNotificationToRoles(
  roles: Array<"admin" | "manager" | "technician">,
  payload: NotificationPayload
) {
  const users = await prismaClient.appUser.findMany({
    where: {
      role: { in: roles },
      approvalStatus: "approved",
      employeeRefId: { not: null },
    },
    select: { employeeRefId: true },
  })

  const employeeIds = users
    .map((user: { employeeRefId: number | null }) => user.employeeRefId)
    .filter((employeeId: number | null): employeeId is number => Number.isInteger(employeeId))

  return sendNotificationToEmployees(employeeIds, payload)
}

export async function sendJobAssignmentNotifications(
  technicianIds: Array<string | number>,
  jobDetails: JobAssignmentNotification,
  serverUrl: string
) {
  const employeeIds = technicianIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))

  return sendNotificationToEmployees(employeeIds, {
    title: "New Job Assigned",
    body: `Vehicle: ${jobDetails.vehicleNumber}${jobDetails.taskAssigned ? ` | Task: ${jobDetails.taskAssigned}` : ""}`,
    url: `${serverUrl}/technician`,
    data: {
      jobId: jobDetails.jobId,
      type: "job_assignment",
      vehicleNumber: jobDetails.vehicleNumber,
      taskAssigned: jobDetails.taskAssigned || "",
    },
  })
}

export async function sendJobAssignmentNotification(
  technicianId: string | number,
  jobDetails: JobAssignmentNotification,
  serverUrl: string
) {
  return sendJobAssignmentNotifications([technicianId], jobDetails, serverUrl)
}

export async function sendApprovalResultNotification(
  employeeId: string | number,
  result: ApprovalResultNotification,
  serverUrl: string
) {
  const parsedEmployeeId = Number(employeeId)
  if (!Number.isInteger(parsedEmployeeId)) {
    return null
  }

  return sendNotificationToEmployees([parsedEmployeeId], {
    title: result.status === "approved" ? "Registration Approved" : "Registration Rejected",
    body: result.status === "approved"
      ? "Your account is approved. You can log in now."
      : "Your registration request was rejected. Contact admin.",
    url: `${serverUrl}/login`,
    data: {
      type: "approval_result",
      status: result.status,
    },
  })
}

export async function sendApprovalResultNotificationByEmail(
  externalId: string,
  result: ApprovalResultNotification,
  serverUrl: string
) {
  const normalizedExternalId = String(externalId || "").trim().toLowerCase()
  if (!normalizedExternalId) {
    return null
  }

  return sendOneSignalRequestByExternalIds([normalizedExternalId], {
    title: result.status === "approved" ? "Registration Approved" : "Registration Rejected",
    body:
      result.status === "approved"
        ? "Your account is approved. You can log in now."
        : "Your registration request was rejected. Contact admin.",
    url: `${serverUrl}/login`,
    data: {
      type: "approval_result",
      status: result.status,
    },
  })
}

export async function sendJobReassignedNotifications(
  technicianIds: Array<string | number>,
  jobDetails: JobStatusChangeNotification,
  serverUrl: string
) {
  const employeeIds = technicianIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))

  return sendNotificationToEmployees(employeeIds, {
    title: "Job Reassigned",
    body: `Vehicle: ${jobDetails.vehicleNumber || "Unknown vehicle"}`,
    url: `${serverUrl}/technician`,
    data: {
      jobId: jobDetails.jobId,
      type: "job_reassigned",
      vehicleNumber: jobDetails.vehicleNumber || "",
    },
  })
}

export async function sendJobDeletedNotifications(
  technicianIds: Array<string | number>,
  jobDetails: JobStatusChangeNotification,
  serverUrl: string
) {
  const employeeIds = technicianIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))

  return sendNotificationToEmployees(employeeIds, {
    title: "Job Cancelled",
    body: `Vehicle: ${jobDetails.vehicleNumber || "Unknown vehicle"}`,
    url: `${serverUrl}/technician`,
    data: {
      jobId: jobDetails.jobId,
      type: "job_deleted",
      vehicleNumber: jobDetails.vehicleNumber || "",
    },
  })
}

export async function sendTechnicianAcceptedNotification(
  serverUrl: string,
  details: { allocationId: string; vehicleNumber: string; technicianName: string; jobId: string }
) {
  return sendNotificationToRoles(["admin", "manager"], {
    title: "Job Accepted",
    body: `${details.technicianName} accepted job for ${details.vehicleNumber}`,
    url: `${serverUrl}/job/${details.jobId}`,
    data: {
      allocationId: details.allocationId,
      jobId: details.jobId,
      type: "job_accepted",
    },
  })
}

export async function sendTechnicianCompletedNotification(
  serverUrl: string,
  details: { allocationId: string; vehicleNumber: string; technicianName: string; jobId: string }
) {
  return sendNotificationToRoles(["admin", "manager"], {
    title: "Job Completed",
    body: `${details.technicianName} completed job for ${details.vehicleNumber}`,
    url: `${serverUrl}/job/${details.jobId}`,
    data: {
      allocationId: details.allocationId,
      jobId: details.jobId,
      type: "job_completed",
    },
  })
}