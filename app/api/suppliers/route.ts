import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

interface ProductInput {
  productName: string
  unit?: string | null
  productDescription?: string | null
  hsnCode?: string | null
  mrp?: number
  cgstRate?: number
  purchasePrice?: number
  salePrice?: number
  sgstRate?: number
  igstRate?: number
  createdOn?: string | null
}

const parseDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const normalizeProducts = (items: unknown): ProductInput[] => {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        productName: String(row.productName || "").trim(),
        unit: String(row.unit || "").trim() || null,
        productDescription: String(row.productDescription || "").trim() || null,
        hsnCode: String(row.hsnCode || "").trim() || null,
        mrp: Number(row.mrp || 0),
        cgstRate: Number(row.cgstRate || 0),
        purchasePrice: Number(row.purchasePrice || 0),
        salePrice: Number(row.salePrice || 0),
        sgstRate: Number(row.sgstRate || 0),
        igstRate: Number(row.igstRate || 0),
        createdOn: String(row.createdOn || "") || null,
      }
    })
    .filter((row: ProductInput) => row.productName.length > 0)
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() || ""

    const suppliers = await prisma.supplier.findMany({
      where: search
        ? {
            OR: [
              { supplierName: { contains: search } },
              { mobileNo: { contains: search } },
            ],
          }
        : undefined,
      select: {
        supplierId: true,
        supplierName: true,
        mobileNo: true,
        stateCode: true,
        stateName: true,
        createdOn: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ supplierName: "asc" }, { supplierId: "desc" }],
      take: 100,
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error("[SUPPLIERS_GET]", error)
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const supplierName = String(body.supplierName || "").trim()
    const mobileNo = normalizeMobileNumber(body.mobileNo)

    if (!supplierName || !mobileNo) {
      return NextResponse.json(
        { error: "SupplierName and MobileNo are required" },
        { status: 400 }
      )
    }

    if (!isValidMobileNumber(mobileNo)) {
      return NextResponse.json(
        { error: "MobileNo must be exactly 10 digits" },
        { status: 400 }
      )
    }

    const products = normalizeProducts(body.products)

    const created = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          supplierName,
          address: String(body.address || "").trim() || null,
          mobileNo,
          stateCode: String(body.stateCode || body.stateId || "").trim() || null,
          stateName: String(body.stateName || "").trim() || null,
          gstin: String(body.gstin || "").trim() || null,
          pan: String(body.pan || "").trim() || null,
          createdOn: parseDate(body.createdOn) || new Date(),
        },
      })

      if (products.length > 0) {
        await tx.product.createMany({
          data: products.map((item) => ({
            supplierId: supplier.supplierId,
            productName: item.productName,
            unit: item.unit || null,
            productDescription: item.productDescription || null,
            hsnCode: item.hsnCode || null,
            mrp: Number(item.mrp || 0),
            cgstRate: Number(item.cgstRate || 0),
            purchasePrice: Number(item.purchasePrice || 0),
            salePrice: Number(item.salePrice || 0),
            sgstRate: Number(item.sgstRate || 0),
            igstRate: Number(item.igstRate || 0),
            createdOn: parseDate(item.createdOn) || new Date(),
          })),
        })
      }

      return tx.supplier.findUnique({
        where: { supplierId: supplier.supplierId },
        include: {
          products: {
            orderBy: [{ productId: "asc" }],
          },
        },
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("[SUPPLIERS_POST]", error)
    return NextResponse.json(
      {
        error: "Failed to create supplier",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
