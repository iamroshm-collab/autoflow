import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"
import { createRoleNotifications, createUserNotification } from "@/lib/app-notifications"
import { sendMetaWhatsappBreakdownNotification, sendMetaWhatsappBreakdownPickupNotification } from "@/lib/meta-whatsapp"

const db = prisma as any

const isBreakdownModelReady = () => {
  return Boolean(db?.breakdown && db?.breakdownMilestone)
}

// Department → breakdown type mapping
// Technicians are looked up first by department field, then fall back to designation for legacy records.
const BREAKDOWN_TYPE_DEPARTMENTS: Record<string, string[]> = {
  Mechanical: ["Mechanical"],
  Electrical: ["Electrical"],
  AC: ["AC / Air Conditioning"],
  Other: ["Mechanical", "Electrical", "AC / Air Conditioning"],
}

// Legacy designation fallback (for employees without a department set)
const BREAKDOWN_TYPE_DESIGNATIONS: Record<string, string[]> = {
  Mechanical: ["Mechanic", "Supervisor", "Helper"],
  Electrical: ["Electrician"],
  AC: ["AC Technician"],
  Other: ["Mechanic", "Electrician", "AC Technician", "Supervisor"],
}

async function generateBreakdownNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `BD-${year}-`
  const last = await db.breakdown.findFirst({
    where: { breakdownNumber: { startsWith: prefix } },
    orderBy: { breakdownNumber: "desc" },
  })
  const seq = last
    ? parseInt(last.breakdownNumber.replace(prefix, ""), 10) + 1
    : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isBreakdownModelReady()) {
      console.warn("[BREAKDOWN_GET] Breakdown model is unavailable on Prisma client. Returning empty list.")
      return NextResponse.json([])
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || ""
    const q = searchParams.get("q") || ""
    const take = Math.min(parseInt(searchParams.get("take") || "100"), 200)

    const where: any = {}
    if (status) where.status = status
    if (q) {
      where.OR = [
        { breakdownNumber: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { mobileNo: { contains: q, mode: "insensitive" } } },
        { vehicle: { registrationNumber: { contains: q, mode: "insensitive" } } },
      ]
    }

    const breakdowns = await db.breakdown.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, mobileNo: true } },
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    })

    return NextResponse.json(breakdowns)
  } catch (error) {
    console.error("[BREAKDOWN_GET]", error)
    return NextResponse.json({ error: "Failed to fetch breakdowns" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const role = String(user.role || "").toLowerCase()
    if (role === "technician") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { customerId, vehicleId, breakdownType, reason, location, kmDriven } = body

    if (!customerId || !vehicleId || !breakdownType || !reason) {
      return NextResponse.json(
        { error: "customerId, vehicleId, breakdownType, and reason are required" },
        { status: 400 }
      )
    }

    const validTypes = ["Mechanical", "Electrical", "AC", "Other"]
    if (!validTypes.includes(breakdownType)) {
      return NextResponse.json({ error: "Invalid breakdownType" }, { status: 400 })
    }

    const breakdownNumber = await generateBreakdownNumber()

    const breakdown = await db.breakdown.create({
      data: {
        breakdownNumber,
        status: "Pending",
        breakdownType,
        reason,
        location: location || null,
        kmDriven: kmDriven ? parseInt(kmDriven) : null,
        customerId,
        vehicleId,
        createdByUserId: user.id,
        createdByName: (user as any).name || null,
      },
      include: {
        customer: true,
        vehicle: true,
      },
    })

    // Milestone: Created
    await db.breakdownMilestone.create({
      data: {
        breakdownId: breakdown.id,
        event: "Created",
        actorUserId: user.id,
        actorName: (user as any).name || null,
        note: `Breakdown ${breakdownNumber} created`,
      },
    })

    // Find eligible technicians — primary: by department, fallback: by designation (legacy)
    const targetDepartments = BREAKDOWN_TYPE_DEPARTMENTS[breakdownType] || []
    const targetDesignations = BREAKDOWN_TYPE_DESIGNATIONS[breakdownType] || []

    const byDepartment = await db.employee.findMany({
      where: {
        department: { in: targetDepartments },
        isTechnician: true,
        isArchived: false,
        isAttendanceEligible: true,
      },
      include: { appUser: { select: { id: true } } },
    })

    // Legacy fallback: employees with no department but matching designation
    const byDesignation = await db.employee.findMany({
      where: {
        department: null,
        designation: { in: targetDesignations },
        isTechnician: true,
        isArchived: false,
        isAttendanceEligible: true,
      },
      include: { appUser: { select: { id: true } } },
    })

    const seenIds = new Set<number>()
    const technicians = [...byDepartment, ...byDesignation].filter((t: any) => {
      if (seenIds.has(t.employeeId)) return false
      seenIds.add(t.employeeId)
      return true
    })

    // Send WhatsApp & in-app notifications to matching technicians
    let notifiedCount = 0
    const techUserIds: string[] = []

    for (const tech of technicians) {
      const techDepartment = tech.department || breakdownType
      try {
        // Send new pickup-format message if template is configured
        await sendMetaWhatsappBreakdownPickupNotification({
          mobile: tech.mobile,
          technicianName: tech.empName,
          department: techDepartment,
          breakdownNumber,
          location: location || "Not specified",
        })
        notifiedCount++
      } catch {
        // fallback to legacy template
        try {
          await sendMetaWhatsappBreakdownNotification({
            mobile: tech.mobile,
            technicianName: tech.empName,
            breakdownNumber,
            breakdownType,
            vehicleReg: breakdown.vehicle.registrationNumber,
            customerName: breakdown.customer.name,
            location: location || "Not specified",
          })
          notifiedCount++
        } catch {
          // non-fatal
        }
      }

      if (tech.appUser?.id) {
        techUserIds.push(tech.appUser.id)
        await createUserNotification(tech.appUser.id, {
          title: `New ${breakdownType} Breakdown`,
          body: `${breakdown.vehicle.registrationNumber} — ${breakdown.customer.name}. Tap to accept.`,
          targetForm: "breakdown",
          url: `/?form=breakdown&breakdownId=${breakdown.id}`,
          type: "breakdown_new",
          refType: "breakdown",
          refId: breakdown.id,
        })
      }
    }

    // Notify admin/manager
    await createRoleNotifications(["admin", "manager"], {
      title: `Breakdown Reported: ${breakdownNumber}`,
      body: `${breakdownType} — ${breakdown.vehicle.registrationNumber} (${breakdown.customer.name}). ${notifiedCount} technician(s) notified.`,
      targetForm: "breakdown",
      url: `/?form=breakdown&breakdownId=${breakdown.id}`,
      type: "breakdown_created",
      refType: "breakdown",
      refId: breakdown.id,
    })

    // Update status to Notified
    await db.breakdown.update({
      where: { id: breakdown.id },
      data: { status: techUserIds.length > 0 ? "Notified" : "Pending" },
    })

    // Milestone: Notifications sent
    if (techUserIds.length > 0) {
      await db.breakdownMilestone.create({
        data: {
          breakdownId: breakdown.id,
          event: "NotificationsSent",
          actorUserId: user.id,
          actorName: (user as any).name || null,
          note: `Notified ${techUserIds.length} ${breakdownType} technician(s)`,
        },
      })
    }

    return NextResponse.json({ ...breakdown, status: techUserIds.length > 0 ? "Notified" : "Pending" }, { status: 201 })
  } catch (error) {
    console.error("[BREAKDOWN_POST]", error)
    return NextResponse.json({ error: "Failed to create breakdown" }, { status: 500 })
  }
}
