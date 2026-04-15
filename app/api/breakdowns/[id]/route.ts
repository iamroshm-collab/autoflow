import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { createRoleNotifications, createUserNotification, removeNotificationsByRef } from "@/lib/app-notifications"

const db = prisma as any

const isBreakdownModelReady = () => {
  return Boolean(db?.breakdown && db?.breakdownMilestone)
}

const BREAKDOWN_INCLUDE = {
  customer: { select: { id: true, name: true, mobileNo: true } },
  vehicle: { select: { id: true, registrationNumber: true, make: true, model: true, year: true } },
  milestones: { orderBy: { createdAt: "asc" as const } },
  jobCard: { select: { id: true, jobCardNumber: true } },
}

/**
 * Departments eligible to accept each breakdown type.
 * "Other" allows any of the three main technical departments — chosen as the
 * widest reasonable fallback so no breakdowns go unaccepted.
 */
const BREAKDOWN_ELIGIBLE_DEPARTMENTS: Record<string, string[]> = {
  Mechanical: ["Mechanical"],
  Electrical: ["Electrical"],
  AC: ["AC / Air Conditioning"],
  Other: ["Mechanical", "Electrical", "AC / Air Conditioning"],
}

/** Legacy designation fallback for employees whose department is null. */
const BREAKDOWN_ELIGIBLE_DESIGNATIONS: Record<string, string[]> = {
  Mechanical: ["Mechanic", "Senior Mechanic", "Foreman", "Workshop Supervisor", "Helper", "Trainee"],
  Electrical: ["Auto Electrician", "Senior Electrician", "Electrical Helper", "Electrician"],
  AC: ["AC Technician", "Senior AC Technician", "AC Helper"],
  Other: [
    "Mechanic", "Senior Mechanic", "Foreman", "Workshop Supervisor",
    "Auto Electrician", "Senior Electrician", "Electrician",
    "AC Technician", "Senior AC Technician",
  ],
}

/**
 * Resolve whether the current user's employee record is eligible to accept a
 * breakdown of the given type.  Returns the employee record on success, or
 * null when ineligible.
 */
async function resolveEligibleEmployee(
  employeeRefId: number,
  breakdownType: string
): Promise<{ employeeId: number; department: string | null; designation: string | null } | null> {
  const emp = await db.employee.findUnique({
    where: { employeeId: employeeRefId },
    select: { employeeId: true, department: true, designation: true, isTechnician: true, isArchived: true },
  })

  if (!emp || !emp.isTechnician || emp.isArchived) return null

  const eligibleDepts = BREAKDOWN_ELIGIBLE_DEPARTMENTS[breakdownType] ?? []
  const eligibleDesigs = BREAKDOWN_ELIGIBLE_DESIGNATIONS[breakdownType] ?? []

  if (emp.department) {
    return eligibleDepts.includes(emp.department) ? emp : null
  }
  // Legacy: no department set — fall back to designation
  return eligibleDesigs.includes(emp.designation ?? "") ? emp : null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isBreakdownModelReady()) {
      return NextResponse.json(
        {
          error:
            "Breakdown module is not initialized yet. Run Prisma migration and regenerate Prisma client, then retry.",
        },
        { status: 503 }
      )
    }

    const breakdown = await db.breakdown.findUnique({
      where: { id },
      include: BREAKDOWN_INCLUDE,
    })

    if (!breakdown) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(breakdown)
  } catch (error) {
    console.error("[BREAKDOWN_GET_ID]", error)
    return NextResponse.json({ error: "Failed to fetch breakdown" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getCurrentUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isBreakdownModelReady()) {
      return NextResponse.json(
        {
          error:
            "Breakdown module is not initialized yet. Run Prisma migration and regenerate Prisma client, then retry.",
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { action } = body

    const breakdown = await db.breakdown.findUnique({
      where: { id },
      include: { customer: true, vehicle: true },
    })

    if (!breakdown) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const role = String(user.role || "").toLowerCase()
    const isAdmin = role === "admin" || role === "manager"
    const isTech = role === "technician"
    const actorName = (user as any).name || "Unknown"
    const actorUserId = user.id
    const employeeRefId = (user as any).employeeRefId ? Number((user as any).employeeRefId) : null

    // ── ACCEPT ──────────────────────────────────────────────────────────────
    if (action === "accept") {
      // Admins/managers must not accept on behalf of technicians
      if (isAdmin) {
        return NextResponse.json(
          { error: "Admins cannot accept a breakdown. Only eligible technicians can." },
          { status: 403 }
        )
      }

      if (!isTech) {
        return NextResponse.json({ error: "Only technicians can accept breakdowns." }, { status: 403 })
      }

      if (!employeeRefId) {
        return NextResponse.json({ error: "No employee record linked to your account." }, { status: 403 })
      }

      // Verify department eligibility
      const eligible = await resolveEligibleEmployee(employeeRefId, breakdown.breakdownType)
      if (!eligible) {
        return NextResponse.json(
          {
            error: `Your department is not eligible to accept ${breakdown.breakdownType} breakdowns.`,
          },
          { status: 403 }
        )
      }

      if (!["Pending", "Notified"].includes(breakdown.status)) {
        return NextResponse.json({ error: "Breakdown already accepted or closed" }, { status: 409 })
      }

      const updated = await db.breakdown.update({
        where: { id },
        data: {
          status: "Accepted",
          acceptedByUserId: actorUserId,
          acceptedByName: actorName,
          acceptedAt: new Date(),
        },
        include: BREAKDOWN_INCLUDE,
      })

      await db.breakdownMilestone.create({
        data: {
          breakdownId: id,
          event: "Accepted",
          actorUserId,
          actorName,
          note: `Accepted by ${actorName}`,
        },
      })

      // Notify admin
      await createRoleNotifications(["admin", "manager"], {
        title: `Breakdown Accepted: ${breakdown.breakdownNumber}`,
        body: `${actorName} accepted the ${breakdown.breakdownType} breakdown for ${breakdown.vehicle.registrationNumber}`,
        targetForm: "breakdown",
        url: `/?form=breakdown&breakdownId=${id}`,
        type: "breakdown_accepted",
        refType: "breakdown",
        refId: id,
      })

      return NextResponse.json(updated)
    }

    // ── PICKED UP ────────────────────────────────────────────────────────────
    if (action === "pickup") {
      if (breakdown.status !== "Accepted") {
        return NextResponse.json({ error: "Breakdown must be accepted before marking picked up" }, { status: 409 })
      }

      // Only the technician who accepted can mark pickup
      if (!isAdmin && breakdown.acceptedByUserId !== actorUserId) {
        return NextResponse.json(
          { error: "Only the technician who accepted this breakdown can mark it as picked up." },
          { status: 403 }
        )
      }

      const updated = await db.breakdown.update({
        where: { id },
        data: { status: "PickedUp" },
        include: BREAKDOWN_INCLUDE,
      })

      await db.breakdownMilestone.create({
        data: {
          breakdownId: id,
          event: "PickedUp",
          actorUserId,
          actorName,
          note: `Vehicle picked up — ${actorName} is en route to garage`,
        },
      })

      await createRoleNotifications(["admin", "manager"], {
        title: `Vehicle Picked Up: ${breakdown.breakdownNumber}`,
        body: `${actorName} picked up ${breakdown.vehicle.registrationNumber} and is heading to the garage.`,
        targetForm: "breakdown",
        url: `/?form=breakdown&breakdownId=${id}`,
        type: "breakdown_pickedup",
        refType: "breakdown",
        refId: id,
      })

      return NextResponse.json(updated)
    }

    // ── REACHED GARAGE ───────────────────────────────────────────────────────
    if (action === "reached_garage") {
      if (!["Accepted", "PickedUp"].includes(breakdown.status)) {
        return NextResponse.json({ error: "Breakdown must be accepted or picked up before marking reached garage" }, { status: 409 })
      }

      // Only the technician who accepted can mark reached_garage
      if (!isAdmin && breakdown.acceptedByUserId !== actorUserId) {
        return NextResponse.json(
          { error: "Only the technician who accepted this breakdown can mark it as reached garage." },
          { status: 403 }
        )
      }

      const updated = await db.breakdown.update({
        where: { id },
        data: {
          status: "ReachedGarage",
          reachedGarageAt: new Date(),
          reachedGarageByUserId: actorUserId,
          reachedGarageByName: actorName,
        },
        include: BREAKDOWN_INCLUDE,
      })

      await db.breakdownMilestone.create({
        data: {
          breakdownId: id,
          event: "ReachedGarage",
          actorUserId,
          actorName,
          note: `Vehicle dropped at garage by ${actorName}`,
        },
      })

      await createRoleNotifications(["admin", "manager"], {
        title: `Vehicle At Garage: ${breakdown.breakdownNumber}`,
        body: `${breakdown.vehicle.registrationNumber} has been dropped at the garage by ${actorName}. Ready to transfer to jobcard.`,
        targetForm: "breakdown",
        url: `/?form=breakdown&breakdownId=${id}`,
        type: "breakdown_reached",
        refType: "breakdown",
        refId: id,
      })

      return NextResponse.json(updated)
    }

    // ── REVERSE ACCEPT (UNACCEPT) ────────────────────────────────────────────
    if (action === "unaccept") {
      // Allowed: the technician who accepted OR admin/manager
      const isAcceptingTech = isTech && breakdown.acceptedByUserId === actorUserId
      if (!isAcceptingTech && !isAdmin) {
        return NextResponse.json(
          { error: "Only the technician who accepted this breakdown or an admin/manager can reverse the acceptance." },
          { status: 403 }
        )
      }

      // Only reversible while in Accepted state
      if (breakdown.status !== "Accepted") {
        const blockedMsg =
          breakdown.status === "PickedUp" || breakdown.status === "ReachedGarage"
            ? "Cannot reverse acceptance — the vehicle is already in transit."
            : `Cannot reverse acceptance in ${breakdown.status} state.`
        return NextResponse.json({ error: blockedMsg }, { status: 409 })
      }

      // Revert to Notified (keeps the original technician notifications in play);
      // if no notifications were ever sent (edge-case), fall back to Pending.
      const prevMilestones: { event: string }[] = await db.breakdownMilestone.findMany({
        where: { breakdownId: id },
        select: { event: true },
      })
      const wasNotified = prevMilestones.some((m: { event: string }) => m.event === "NotificationsSent")
      const revertStatus = wasNotified ? "Notified" : "Pending"

      const updated = await db.breakdown.update({
        where: { id },
        data: {
          status: revertStatus,
          acceptedByUserId: null,
          acceptedByName: null,
          acceptedAt: null,
        },
        include: BREAKDOWN_INCLUDE,
      })

      await db.breakdownMilestone.create({
        data: {
          breakdownId: id,
          event: "ReverseAccepted",
          actorUserId,
          actorName,
          note: `Acceptance reversed by ${actorName}`,
        },
      })

      // Re-notify admin that the breakdown is open again
      await createRoleNotifications(["admin", "manager"], {
        title: `Breakdown Reopened: ${breakdown.breakdownNumber}`,
        body: `${actorName} reversed the acceptance for ${breakdown.vehicle.registrationNumber}. Now open for re-assignment.`,
        targetForm: "breakdown",
        url: `/?form=breakdown&breakdownId=${id}`,
        type: "breakdown_accepted",
        refType: "breakdown",
        refId: id,
      })

      return NextResponse.json(updated)
    }

    // ── TRANSFER TO JOBCARD ──────────────────────────────────────────────────
    if (action === "transfer") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (breakdown.jobCardId) {
        return NextResponse.json({ error: "Already transferred to a jobcard" }, { status: 409 })
      }
      if (!["ReachedGarage", "PickedUp", "Accepted"].includes(breakdown.status)) {
        return NextResponse.json({ error: "Breakdown must be accepted, picked up, or at garage before transfer" }, { status: 409 })
      }

      const { maintenanceType, fileNo } = body

      // Generate jobcard number
      const year = new Date().getFullYear()
      const shopCode = String(process.env.SHOP_CODE || "AL")
      const prefix = `JC-${shopCode}-${year}-`
      const lastJc = await db.jobCard.findFirst({
        where: { jobCardNumber: { startsWith: prefix } },
        orderBy: { jobCardNumber: "desc" },
      })
      const seq = lastJc ? parseInt(lastJc.jobCardNumber.replace(prefix, ""), 10) + 1 : 1
      const jobCardNumber = `${prefix}${String(seq).padStart(4, "0")}`

      const jobCard = await db.jobCard.create({
        data: {
          jobCardNumber,
          shopCode,
          serviceDate: new Date(),
          customerId: breakdown.customerId,
          vehicleId: breakdown.vehicleId,
          kmDriven: breakdown.kmDriven || null,
          fileNo: fileNo || null,
          maintenanceType: maintenanceType || breakdown.breakdownType,
          jobcardStatus: "Under Service",
          mechanical: breakdown.breakdownType === "Mechanical",
          electrical: breakdown.breakdownType === "Electrical",
          ac: breakdown.breakdownType === "AC",
        },
      })

      const updated = await db.breakdown.update({
        where: { id },
        data: {
          status: "Transferred",
          jobCardId: jobCard.id,
          transferredAt: new Date(),
          transferredByUserId: actorUserId,
          transferredByName: actorName,
        },
        include: BREAKDOWN_INCLUDE,
      })

      await db.breakdownMilestone.create({
        data: {
          breakdownId: id,
          event: "Transferred",
          actorUserId,
          actorName,
          note: `Transferred to jobcard ${jobCardNumber}`,
        },
      })

      // Clear old breakdown notifications
      await removeNotificationsByRef("breakdown", id, { roles: ["admin", "manager"] })

      await createRoleNotifications(["admin", "manager"], {
        title: `Breakdown Transferred: ${breakdown.breakdownNumber}`,
        body: `Jobcard ${jobCardNumber} created from breakdown ${breakdown.breakdownNumber}`,
        targetForm: "update-job-card",
        url: `/?form=update-job-card&jobCardId=${jobCard.id}`,
        type: "breakdown_transferred",
        refType: "breakdown",
        refId: id,
      })

      return NextResponse.json({ ...updated, newJobCard: jobCard })
    }

    // ── CANCEL ───────────────────────────────────────────────────────────────
    if (action === "cancel") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (["Transferred", "Cancelled"].includes(breakdown.status)) {
        return NextResponse.json({ error: "Cannot cancel a transferred or already cancelled breakdown" }, { status: 409 })
      }

      const updated = await db.breakdown.update({
        where: { id },
        data: { status: "Cancelled" },
        include: BREAKDOWN_INCLUDE,
      })

      await db.breakdownMilestone.create({
        data: {
          breakdownId: id,
          event: "Cancelled",
          actorUserId,
          actorName,
          note: `Cancelled by ${actorName}`,
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("[BREAKDOWN_ACTION]", error)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
