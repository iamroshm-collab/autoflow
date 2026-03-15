import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const registration = searchParams.get("registration")?.trim()

    if (!registration) {
      return NextResponse.json({ error: "registration is required" }, { status: 400 })
    }

    const normalized = registration.toUpperCase()

    const vehicle = await prisma.vehicle.findUnique({
      where: { registrationNumber: normalized },
      include: { lastCustomer: true },
    })

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }

    return NextResponse.json(vehicle)
  } catch (error) {
    console.error("[VEHICLE_BY_REG_GET]", error)
    return NextResponse.json({ error: "Failed to fetch vehicle" }, { status: 500 })
  }
}
