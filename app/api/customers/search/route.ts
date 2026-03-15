import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query")?.trim() || ""

    if (!query) {
      return NextResponse.json([])
    }

    const [customersByText, vehiclesByRegistration] = await Promise.all([
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { mobileNo: { contains: query } },
          ],
        },
        include: {
          lastCustomerFor: {
            select: {
              id: true,
              registrationNumber: true,
              make: true,
              model: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
      prisma.vehicle.findMany({
        where: {
          registrationNumber: { contains: query.toUpperCase() },
        },
        include: {
          lastCustomer: true,
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ])

    const map = new Map<string, any>()

    for (const customer of customersByText) {
      map.set(customer.id, {
        ...customer,
        matchedBy: "customer",
      })
    }

    for (const vehicle of vehiclesByRegistration) {
      const customer = vehicle.lastCustomer
      if (customer) {
        map.set(customer.id, {
          ...customer,
          matchedBy: "registration",
        })
      }
    }

    return NextResponse.json(Array.from(map.values()))
  } catch (error) {
    console.error("[CUSTOMERS_SEARCH_GET]", error)
    return NextResponse.json({ error: "Failed to search customers" }, { status: 500 })
  }
}
