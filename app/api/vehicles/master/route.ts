import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const q = (url.searchParams.get("q") || "").trim().toUpperCase()

    const vehicles = await prisma.vehicle.findMany({
      where: q
        ? {
            registrationNumber: {
              contains: q,
            },
          }
        : undefined,
      orderBy: [{ registrationNumber: "asc" }],
      take: 200,
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
