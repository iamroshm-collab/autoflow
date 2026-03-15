import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// GET /api/vehicle-makes-models - Fetch all makes or models for a specific make
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const make = searchParams.get("make")
    const search = searchParams.get("search")

    if (make) {
      // Fetch models for a specific make
      const models = await prisma.vehicleMakeModel.findMany({
        where: {
          make: {
            equals: make,
            mode: "insensitive",
          },
          isActive: true,
          ...(search && {
            model: {
              contains: search,
              mode: "insensitive",
            },
          }),
        },
        select: {
          id: true,
          model: true,
          category: true,
        },
        orderBy: {
          model: "asc",
        },
      })

      return NextResponse.json(models)
    }

    // Fetch all unique makes
    const makes = await prisma.vehicleMakeModel.findMany({
      where: {
        isActive: true,
        ...(search && {
          make: {
            contains: search,
            mode: "insensitive",
          },
        }),
      },
      select: {
        make: true,
      },
      distinct: ["make"],
      orderBy: {
        make: "asc",
      },
    })

    const uniqueMakes = makes.map((m) => m.make)
    return NextResponse.json(uniqueMakes)
  } catch (error) {
    console.error("Error fetching vehicle makes/models:", error)
    return NextResponse.json(
      { error: "Failed to fetch vehicle data" },
      { status: 500 }
    )
  }
}

// POST /api/vehicle-makes-models - Add a new make/model combination
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { make, model, category = "Car" } = body

    if (!make || !model) {
      return NextResponse.json(
        { error: "Make and model are required" },
        { status: 400 }
      )
    }

    const cleanMake = make.trim()
    const cleanModel = model.trim()

    // Check if already exists
    const existing = await prisma.vehicleMakeModel.findFirst({
      where: {
        make: {
          equals: cleanMake,
          mode: "insensitive",
        },
        model: {
          equals: cleanModel,
          mode: "insensitive",
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "This make and model combination already exists" },
        { status: 409 }
      )
    }

    // Create new make/model
    const newEntry = await prisma.vehicleMakeModel.create({
      data: {
        make: cleanMake,
        model: cleanModel,
        category,
        isActive: true,
      },
    })

    return NextResponse.json(newEntry, { status: 201 })
  } catch (error) {
    console.error("Error creating vehicle make/model:", error)
    return NextResponse.json(
      { error: "Failed to create vehicle make/model" },
      { status: 500 }
    )
  }
}
