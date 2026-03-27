import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  calculateDistanceMeters,
  calculateWorkedMinutes,
  deriveAttendanceCode,
  deriveNextAttendanceAction,
  formatWorkedDuration,
  isAdminLikeDesignation,
  toDayStart,
  toNextDay,
} from "@/lib/attendance"
import {
  getAttendanceFaceVerificationMode,
  verifyAttendanceEvidence,
} from "@/lib/attendance-face-verification"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

async function getEligibleEmployee(employeeId: number) {
  return prisma.employee.findFirst({
    where: {
      employeeId,
      isArchived: false,
      isAttendanceEligible: true,
    },
    select: {
      employeeId: true,
      empName: true,
      mobile: true,
      designation: true,
      facePhotoUrl: true,
      isAttendanceEligible: true,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminLikeRole = currentUser.role === "admin" || currentUser.role === "manager"
    const employeeIdParam = request.nextUrl.searchParams.get("employeeId")

    if (!employeeIdParam) {
      if (!isAdminLikeRole) {
        if (!Number.isInteger(currentUser.employeeRefId)) {
          return NextResponse.json({ error: "Employee mapping is missing for this account" }, { status: 400 })
        }

        const selfEmployeeId = Number(currentUser.employeeRefId)
        const [employee, shopSettings, lastRecord, todayRecord] = await Promise.all([
          getEligibleEmployee(selfEmployeeId),
          prisma.shopSettings.findFirst({ orderBy: { createdAt: "asc" } }),
          prisma.attendancePayroll.findFirst({
            where: { employeeId: selfEmployeeId },
            orderBy: [{ attendanceDate: "desc" }, { attendanceId: "desc" }],
          }),
          prisma.attendancePayroll.findFirst({
            where: {
              employeeId: selfEmployeeId,
              attendanceDate: {
                gte: toDayStart(new Date()),
                lt: toNextDay(new Date()),
              },
            },
          }),
        ])

        if (!employee || isAdminLikeDesignation(employee.designation)) {
          return NextResponse.json({ error: "Employee is not eligible for attendance" }, { status: 404 })
        }

        const nextAction = deriveNextAttendanceAction(lastRecord)
        return NextResponse.json({
          employee,
          nextAction,
          todayRecord: todayRecord
            ? {
                ...todayRecord,
                workedDuration: formatWorkedDuration(todayRecord.workedMinutes),
              }
            : null,
          garageLocationConfigured: Boolean(shopSettings?.garageLatitude != null && shopSettings?.garageLongitude != null),
          attendanceRadiusMeters: shopSettings?.attendanceRadiusMeters || 20,
          faceVerificationMode: getAttendanceFaceVerificationMode(),
        })
      }

      const employees = await prisma.employee.findMany({
        where: {
          isArchived: false,
          isAttendanceEligible: true,
        },
        select: {
          employeeId: true,
          empName: true,
          mobile: true,
          designation: true,
          facePhotoUrl: true,
        },
        orderBy: [{ empName: "asc" }, { employeeId: "asc" }],
      })

      return NextResponse.json(
        employees.filter((employee) => !isAdminLikeDesignation(employee.designation))
      )
    }

    const employeeId = Number(employeeIdParam)
    if (!Number.isInteger(employeeId)) {
      return NextResponse.json({ error: "Valid employeeId is required" }, { status: 400 })
    }

    if (!isAdminLikeRole) {
      if (!Number.isInteger(currentUser.employeeRefId)) {
        return NextResponse.json({ error: "Employee mapping is missing for this account" }, { status: 400 })
      }

      if (Number(currentUser.employeeRefId) !== employeeId) {
        return NextResponse.json({ error: "You can only access your own attendance" }, { status: 403 })
      }
    }

    const [employee, shopSettings, lastRecord, todayRecord] = await Promise.all([
      getEligibleEmployee(employeeId),
      prisma.shopSettings.findFirst({ orderBy: { createdAt: "asc" } }),
      prisma.attendancePayroll.findFirst({
        where: { employeeId },
        orderBy: [{ attendanceDate: "desc" }, { attendanceId: "desc" }],
      }),
      prisma.attendancePayroll.findFirst({
        where: {
          employeeId,
          attendanceDate: {
            gte: toDayStart(new Date()),
            lt: toNextDay(new Date()),
          },
        },
      }),
    ])

    if (!employee || isAdminLikeDesignation(employee.designation)) {
      return NextResponse.json({ error: "Employee is not eligible for attendance" }, { status: 404 })
    }

    const nextAction = deriveNextAttendanceAction(lastRecord)
    return NextResponse.json({
      employee,
      nextAction,
      todayRecord: todayRecord
        ? {
            ...todayRecord,
            workedDuration: formatWorkedDuration(todayRecord.workedMinutes),
          }
        : null,
      garageLocationConfigured: Boolean(shopSettings?.garageLatitude != null && shopSettings?.garageLongitude != null),
      attendanceRadiusMeters: shopSettings?.attendanceRadiusMeters || 20,
      faceVerificationMode: getAttendanceFaceVerificationMode(),
    })
  } catch (error) {
    console.error("[MOBILE_ATTENDANCE_GET]", error)
    return NextResponse.json({ error: "Failed to load mobile attendance" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminLikeRole = currentUser.role === "admin" || currentUser.role === "manager"
    const body = await request.json()
    const employeeId = Number(body.employeeId)
    const action = String(body.action || "").toUpperCase()
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)
    const videoUrl = String(body.videoUrl || "").trim()
    const clientVerification = body.clientVerification

    if (!Number.isInteger(employeeId) || !["IN", "OUT"].includes(action)) {
      return NextResponse.json({ error: "Valid employeeId and action are required" }, { status: 400 })
    }

    if (!isAdminLikeRole) {
      if (!Number.isInteger(currentUser.employeeRefId)) {
        return NextResponse.json({ error: "Employee mapping is missing for this account" }, { status: 400 })
      }

      if (Number(currentUser.employeeRefId) !== employeeId) {
        return NextResponse.json({ error: "You can only mark your own attendance" }, { status: 403 })
      }
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Valid latitude and longitude are required" }, { status: 400 })
    }

    if (!videoUrl) {
      return NextResponse.json({ error: "Attendance evidence is required" }, { status: 400 })
    }

    const [employee, shopSettings, todayRecord] = await Promise.all([
      getEligibleEmployee(employeeId),
      prisma.shopSettings.findFirst({ orderBy: { createdAt: "asc" } }),
      prisma.attendancePayroll.findFirst({
        where: {
          employeeId,
          attendanceDate: {
            gte: toDayStart(new Date()),
            lt: toNextDay(new Date()),
          },
        },
      }),
    ])

    if (!employee || isAdminLikeDesignation(employee.designation)) {
      return NextResponse.json({ error: "Employee is not eligible for attendance" }, { status: 404 })
    }

    if (!employee.facePhotoUrl) {
      return NextResponse.json({ error: "Employee reference photo is missing. Ask admin to upload it first." }, { status: 400 })
    }

    if (shopSettings?.garageLatitude == null || shopSettings?.garageLongitude == null) {
      return NextResponse.json({ error: "Garage location is not configured in Shop Settings" }, { status: 400 })
    }

    const distanceMeters = calculateDistanceMeters(
      latitude,
      longitude,
      Number(shopSettings.garageLatitude),
      Number(shopSettings.garageLongitude)
    )

    if (distanceMeters > Number(shopSettings.attendanceRadiusMeters || 20)) {
      return NextResponse.json(
        {
          error: `You must be within ${shopSettings.attendanceRadiusMeters || 20} meters of the garage to mark attendance`,
          distanceMeters,
        },
        { status: 400 }
      )
    }

    const verification = await verifyAttendanceEvidence({
      employeeId,
      action: action as "IN" | "OUT",
      referenceImageUrl: employee.facePhotoUrl,
      videoUrl,
      clientVerification,
    })
    if (!verification.passed) {
      return NextResponse.json(
        {
          error: verification.reason,
          verificationStatus: verification.status,
          verificationProvider: verification.provider,
        },
        { status: 501 }
      )
    }

    const now = new Date()
    const attendanceDate = toDayStart(now)
    let record

    if (action === "IN") {
      if (todayRecord?.checkInAt && !todayRecord.checkOutAt) {
        return NextResponse.json({ error: "You are already checked in. Please check out next." }, { status: 400 })
      }

      record = todayRecord
        ? await prisma.attendancePayroll.update({
            where: { attendanceId: todayRecord.attendanceId },
            data: {
              attendance: "IN",
              checkInAt: now,
              checkOutAt: null,
              workedMinutes: null,
              attendanceMethod: "mobile_geo_face",
              verificationProvider: verification.provider,
              verificationStatus: verification.status,
              checkInVideoUrl: videoUrl,
              checkInVerificationScore: verification.score,
              checkInLatitude: latitude,
              checkInLongitude: longitude,
              checkInDistanceMeters: distanceMeters,
            },
          })
        : await prisma.attendancePayroll.create({
            data: {
              employeeId,
              attendanceDate,
              attendance: "IN",
              checkInAt: now,
              attendanceMethod: "mobile_geo_face",
              verificationProvider: verification.provider,
              verificationStatus: verification.status,
              checkInVideoUrl: videoUrl,
              checkInVerificationScore: verification.score,
              checkInLatitude: latitude,
              checkInLongitude: longitude,
              checkInDistanceMeters: distanceMeters,
            },
          })
    } else {
      if (!todayRecord?.checkInAt || todayRecord.checkOutAt) {
        return NextResponse.json({ error: "You must check in before you can check out" }, { status: 400 })
      }

      const workedMinutes = calculateWorkedMinutes(todayRecord.checkInAt, now)
      record = await prisma.attendancePayroll.update({
        where: { attendanceId: todayRecord.attendanceId },
        data: {
          attendance: deriveAttendanceCode(workedMinutes),
          checkOutAt: now,
          workedMinutes,
          attendanceMethod: "mobile_geo_face",
          verificationProvider: verification.provider,
          verificationStatus: verification.status,
          checkOutVideoUrl: videoUrl,
          checkOutVerificationScore: verification.score,
          checkOutLatitude: latitude,
          checkOutLongitude: longitude,
          checkOutDistanceMeters: distanceMeters,
        },
      })
    }

    return NextResponse.json({
      success: true,
      record: {
        ...record,
        workedDuration: formatWorkedDuration(record.workedMinutes),
      },
      nextAction: deriveNextAttendanceAction(record),
      verificationProvider: verification.provider,
    })
  } catch (error) {
    console.error("[MOBILE_ATTENDANCE_POST]", error)
    return NextResponse.json({ error: "Failed to register mobile attendance" }, { status: 500 })
  }
}