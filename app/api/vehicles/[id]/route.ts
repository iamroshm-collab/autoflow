import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toProperCase, toUpperCase } from "@/lib/utils"

const parseId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  return id?.trim() || ""
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await parseId(params)
    if (!id) {
      return NextResponse.json({ error: "VehicleID is required" }, { status: 400 })
    }

    const body = await request.json()
    const registrationNumber = String(body.registrationNumber || "").trim()
    const make = String(body.make || "").trim()
    const model = String(body.model || "").trim()

    if (!registrationNumber || !make || !model) {
      return NextResponse.json(
        { error: "Registration number, make, and model are required" },
        { status: 400 }
      )
    }

    const duplicate = await prisma.vehicle.findFirst({
      where: {
        registrationNumber: toUpperCase(registrationNumber),
        id: {
          not: id,
        },
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json(
        { error: "Another vehicle already uses this registration number" },
        { status: 409 }
      )
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        registrationNumber: toUpperCase(registrationNumber),
        make: toProperCase(make),
        model: toProperCase(model),
      },
      select: {
        id: true,
        registrationNumber: true,
        make: true,
        model: true,
        createdAt: true,
        lastCustomerId: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[VEHICLES_ID_PUT]", error)
    return NextResponse.json({ error: "Failed to update vehicle" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await parseId(params)
    if (!id) {
      return NextResponse.json({ error: "VehicleID is required" }, { status: 400 })
    }

    const existing = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }

    await prisma.vehicle.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[VEHICLES_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete vehicle" }, { status: 500 })
  }
}
