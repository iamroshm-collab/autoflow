import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toProperCase } from "@/lib/utils"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

const prismaClient = prisma as any

const parseId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  return id?.trim() || ""
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await parseId(params)
    if (!id) {
      return NextResponse.json({ error: "CustomerID is required" }, { status: 400 })
    }

    const customer = await prismaClient.customer.findUnique({
      where: { id },
      select: {
        id: true,
        mobileNo: true,
        name: true,
        email: true,
        address: true,
        city: true,
        state: true,
        stateId: true,
        pincode: true,
        lastCustomerFor: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
            createdAt: true,
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("[CUSTOMERS_ID_GET]", error)
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await parseId(params)
    if (!id) {
      return NextResponse.json({ error: "CustomerID is required" }, { status: 400 })
    }

    const body = await request.json()

    const name = String(body.name || "").trim()
    const mobileNo = normalizeMobileNumber(body.mobileNo)

    if (!name || !mobileNo) {
      return NextResponse.json(
        { error: "Customer name and mobile number are required" },
        { status: 400 }
      )
    }

    if (!isValidMobileNumber(mobileNo)) {
      return NextResponse.json(
        { error: "Mobile number must be exactly 10 digits" },
        { status: 400 }
      )
    }

    const duplicate = await prismaClient.customer.findFirst({
      where: {
        mobileNo,
        id: {
          not: id,
        },
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json(
        { error: "Another customer already uses this mobile number" },
        { status: 409 }
      )
    }

    const updated = await prismaClient.customer.update({
      where: { id },
      data: {
        name: toProperCase(name),
        mobileNo,
        address: String(body.address || "").trim() || null,
        city: String(body.city || "").trim() || null,
        state: String(body.state || "").trim() || null,
        stateId: String(body.stateId || "").trim() || null,
        pincode: String(body.pincode || "").trim() || null,
      },
      select: {
        id: true,
        mobileNo: true,
        name: true,
        email: true,
        address: true,
        city: true,
        state: true,
        stateId: true,
        pincode: true,
        lastCustomerFor: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
            createdAt: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[CUSTOMERS_ID_PUT]", error)
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await parseId(params)
    if (!id) {
      return NextResponse.json({ error: "CustomerID is required" }, { status: 400 })
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.stateId !== undefined) {
      const stateIdVal = String(body.stateId || "").trim() || null
      updateData.stateId = stateIdVal
      if (stateIdVal && body.state === undefined) {
        const stateRecord = await prismaClient.state.findUnique({
          where: { stateId: stateIdVal },
          select: { stateName: true },
        })
        if (stateRecord) {
          updateData.state = stateRecord.stateName
        }
      }
    }
    if (body.state !== undefined) {
      updateData.state = String(body.state || "").trim() || null
    }

    const updated = await prismaClient.customer.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        mobileNo: true,
        name: true,
        email: true,
        address: true,
        city: true,
        state: true,
        stateId: true,
        pincode: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[CUSTOMERS_ID_PATCH]", error)
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = await parseId(params)
    if (!id) {
      return NextResponse.json({ error: "CustomerID is required" }, { status: 400 })
    }

    const existing = await prismaClient.customer.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    await prismaClient.customer.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[CUSTOMERS_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 })
  }
}
