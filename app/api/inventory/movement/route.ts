import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

const MOVEMENT_TYPES = new Set(["PURCHASE", "JOBCARD_USAGE", "SALE", "ADJUSTMENT"])
const REFERENCE_TYPES = new Set(["PURCHASE", "JOBCARD", "SALE", "MANUAL"])

export async function GET(request: NextRequest) {
  try {
    const rawLimit = Number(request.nextUrl.searchParams.get("limit") || "20")
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20

    const movements = await prismaClient.inventoryMovement.findMany({
      include: {
        item: {
          select: {
            productId: true,
            productName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json({ success: true, movements })
  } catch (error) {
    console.error("[INVENTORY_MOVEMENT_GET]", error)
    return NextResponse.json({ success: false, error: "Failed to load inventory movements" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const itemId = Number(body?.itemId)
    const movementType = String(body?.movementType || "").trim().toUpperCase()
    const quantity = Number(body?.quantity)
    const referenceType = String(body?.referenceType || "").trim().toUpperCase()
    const referenceIdRaw = body?.referenceId
    const referenceId =
      referenceIdRaw === undefined || referenceIdRaw === null || String(referenceIdRaw).trim() === ""
        ? null
        : Number(referenceIdRaw)
    const remarksRaw = body?.remarks === undefined || body?.remarks === null ? "" : String(body.remarks)
    const remarks = remarksRaw.trim() ? remarksRaw.trim().slice(0, 500) : null

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ success: false, error: "Valid itemId is required" }, { status: 400 })
    }

    if (!MOVEMENT_TYPES.has(movementType)) {
      return NextResponse.json({ success: false, error: "Invalid movementType" }, { status: 400 })
    }

    if (!Number.isInteger(quantity) || quantity === 0) {
      return NextResponse.json({ success: false, error: "Quantity must be a non-zero integer" }, { status: 400 })
    }

    if (!REFERENCE_TYPES.has(referenceType)) {
      return NextResponse.json({ success: false, error: "Invalid referenceType" }, { status: 400 })
    }

    if (referenceId !== null && (!Number.isInteger(referenceId) || referenceId <= 0)) {
      return NextResponse.json({ success: false, error: "referenceId must be a positive integer" }, { status: 400 })
    }

    const product = await prismaClient.product.findUnique({
      where: { productId: itemId },
      select: { productId: true },
    })

    if (!product) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    }

    const movement = await prismaClient.inventoryMovement.create({
      data: {
        itemId,
        movementType,
        quantity,
        referenceType,
        referenceId,
        remarks,
      },
      include: {
        item: {
          select: {
            productId: true,
            productName: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, movement }, { status: 201 })
  } catch (error) {
    console.error("[INVENTORY_MOVEMENT_POST]", error)
    return NextResponse.json({ success: false, error: "Failed to create inventory movement" }, { status: 500 })
  }
}
