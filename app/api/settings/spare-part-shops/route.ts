import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() || ""

    const shops = await prisma.sparePartShop.findMany({
      where: search
        ? {
            OR: [
              { shopName: { contains: search, mode: "insensitive" } },
              { mobile: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { state: true },
      orderBy: { shopName: "asc" },
      take: 50,
    })
    return NextResponse.json(shops)
  } catch (error) {
    console.error("[SPARE_PART_SHOPS_GET]", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch spare part shops"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { shopName, address, mobile, pan, gstin, stateId } = body
    const normalizedMobile = normalizeMobileNumber(mobile)

    if (!shopName?.trim()) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 })
    }

    if (!isValidMobileNumber(normalizedMobile)) {
      return NextResponse.json({ error: "Mobile number must be exactly 10 digits" }, { status: 400 })
    }

    const shop = await prisma.sparePartShop.create({
      data: {
        shopName: shopName.trim(),
        address: address?.trim() || null,
        mobile: normalizedMobile,
        pan: pan?.trim() || null,
        gstin: gstin?.trim() || null,
        stateId: stateId?.trim() || null,
      },
      include: { state: true },
    })

    return NextResponse.json(shop)
  } catch (error) {
    console.error("[SPARE_PART_SHOPS_POST]", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create spare part shop"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, shopName, address, mobile, pan, gstin, stateId } = body
    const normalizedMobile = normalizeMobileNumber(mobile)

    if (!id) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 })
    }

    if (!shopName?.trim()) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 })
    }

    if (!isValidMobileNumber(normalizedMobile)) {
      return NextResponse.json({ error: "Mobile number must be exactly 10 digits" }, { status: 400 })
    }

    const shop = await prisma.sparePartShop.update({
      where: { id },
      data: {
        shopName: shopName.trim(),
        address: address?.trim() || null,
        mobile: normalizedMobile,
        pan: pan?.trim() || null,
        gstin: gstin?.trim() || null,
        stateId: stateId?.trim() || null,
      },
      include: { state: true },
    })

    return NextResponse.json(shop)
  } catch (error) {
    console.error("[SPARE_PART_SHOPS_PUT]", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to update spare part shop"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 })
    }

    await prisma.sparePartShop.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[SPARE_PART_SHOPS_DELETE]", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to delete spare part shop"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
