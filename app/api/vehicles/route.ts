import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toUpperCase, toProperCase } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get("customerId")
    const registration = searchParams.get("registration")

    // If registration provided, return list of matching vehicles (for suggestions)
    if (registration) {
      const normalized = registration.trim().toUpperCase()

      const vehicles = await prisma.vehicle.findMany({
        where: {
          registrationNumber: {
            contains: normalized,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 40,
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
          year: true,
          color: true,
          lastCustomerId: true,
          createdAt: true,
        },
      })

      return NextResponse.json(vehicles)
    }

    if (!customerId) {
      return NextResponse.json({ error: "customerId or registration is required" }, { status: 400 })
    }

    // Return vehicles where the customer is the lastCustomer (convenience)
    const vehicles = await prisma.vehicle.findMany({
      where: {
        lastCustomerId: customerId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        registrationNumber: true,
        make: true,
        model: true,
        year: true,
        color: true,
        createdAt: true,
      },
    })

    return NextResponse.json(vehicles)
  } catch (error) {
    console.error("[VEHICLES_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { registrationNumber, make, model, year, color, lastCustomerId, transferIfExists } = body

    if (!registrationNumber || !make || !model) {
      return NextResponse.json(
        { error: "Registration number, make and model are required" },
        { status: 400 }
      )
    }

    // Convert to proper format
    registrationNumber = toUpperCase(registrationNumber.trim())
    make = toProperCase(make.trim())
    model = toProperCase(model.trim())
    color = color ? toProperCase(color.trim()) : null

    // Check if vehicle already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registrationNumber },
      select: {
        id: true,
        registrationNumber: true,
        lastCustomerId: true,
        lastCustomer: {
          select: {
            id: true,
            name: true,
            mobileNo: true,
          },
        },
      },
    })

    if (existingVehicle) {
      if (existingVehicle.lastCustomerId === lastCustomerId) {
        return NextResponse.json(
          {
            code: "VEHICLE_EXISTS_SAME_CUSTOMER",
            error: "Vehicle is already registered under this customer",
          },
          { status: 409 }
        )
      }

      if (!transferIfExists) {
        return NextResponse.json(
          {
            code: "VEHICLE_EXISTS_OTHER_CUSTOMER",
            error: "Vehicle is already registered under another customer",
            existingVehicle: {
              id: existingVehicle.id,
              registrationNumber: existingVehicle.registrationNumber,
              lastCustomerId: existingVehicle.lastCustomerId,
              customerName: existingVehicle.lastCustomer?.name || null,
              customerMobileNo: existingVehicle.lastCustomer?.mobileNo || null,
            },
          },
          { status: 409 }
        )
      }

      const transferredVehicle = await prisma.vehicle.update({
        where: { id: existingVehicle.id },
        data: {
          lastCustomerId,
          make,
          model,
          year: year ? parseInt(year) : null,
          color,
        },
        select: {
          id: true,
          registrationNumber: true,
          make: true,
          model: true,
          year: true,
          color: true,
          createdAt: true,
        },
      })

      return NextResponse.json(
        {
          ...transferredVehicle,
          transferred: true,
        },
        { status: 200 }
      )
    }

    // Create new vehicle
    const newVehicle = await prisma.vehicle.create({
      data: {
        registrationNumber,
        make,
        model,
        year: year ? parseInt(year) : null,
        color,
        lastCustomerId: lastCustomerId || null,
      },
      select: {
        id: true,
        registrationNumber: true,
        make: true,
        model: true,
        year: true,
        color: true,
        createdAt: true,
      },
    })

    return NextResponse.json(newVehicle, { status: 201 })
  } catch (error) {
    console.error("[VEHICLES_POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create vehicle" },
      { status: 500 }
    )
  }
}
