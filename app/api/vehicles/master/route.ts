import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: [{ registrationNumber: "asc" }],
      select: {
        id: true,
        registrationNumber: true,
        make: true,
        model: true,
      },
    })

    return NextResponse.json(vehicles)
  } catch (error) {
    console.error("[VEHICLES_MASTER_GET]", error)
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 })
  }
}
