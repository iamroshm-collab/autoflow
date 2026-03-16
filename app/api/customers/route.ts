import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toProperCase } from "@/lib/utils"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

const prismaClient = prisma as any

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")?.trim() || ""

    const customers = await prismaClient.customer.findMany({
      where: search
        ? {
            OR: [
              { mobileNo: { contains: search } },
              { name: { contains: search } },
            ],
          }
        : undefined,
      select: {
        id: true,
        mobileNo: true,
        name: true,
        stateId: true,
        state: true,
      },
      orderBy: [{ name: "asc" }],
      take: 50,
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error("[CUSTOMERS_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { mobileNo, name, email, address, city, stateId, pincode } = body

    if (!mobileNo || !name) {
      return NextResponse.json(
        { error: "Mobile number and name are required" },
        { status: 400 }
      )
    }

    mobileNo = normalizeMobileNumber(mobileNo)
    name = toProperCase(name.trim())
    city = city ? toProperCase(city.trim()) : null

    if (!isValidMobileNumber(mobileNo)) {
      return NextResponse.json(
        { error: "Mobile number must be exactly 10 digits" },
        { status: 400 }
      )
    }

    const existingCustomer = await prismaClient.customer.findUnique({
      where: { mobileNo },
      select: {
        id: true,
      },
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Customer with this mobile number already exists" },
        { status: 409 }
      )
    }

    // Look up state name if stateId is provided
    let stateName = null
    if (stateId) {
      const state = await prismaClient.state.findUnique({
        where: { stateId },
        select: { stateName: true },
      })
      stateName = state?.stateName || null
    }

    const newCustomer = await prismaClient.customer.create({
      data: {
        mobileNo,
        name,
        email: email || null,
        address: address || null,
        city,
        state: stateName,
        stateId: stateId || null,
        pincode: pincode || null,
      },
      select: {
        id: true,
        mobileNo: true,
        name: true,
      },
    })

    return NextResponse.json(newCustomer, { status: 201 })
  } catch (error) {
    console.error("[CUSTOMERS_POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create customer" },
      { status: 500 }
    )
  }
}
