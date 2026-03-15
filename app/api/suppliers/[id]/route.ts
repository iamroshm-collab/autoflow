import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile-validation"

interface ProductInput {
  productId?: number
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
      const parsedProductId = Number(row.productId)
      const productId = Number.isInteger(parsedProductId) && parsedProductId > 0 ? parsedProductId : undefined

      return {
        productId,
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
    .filter((row) => row.productName.length > 0)
}

const parseId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  const supplierId = Number(id)
  return Number.isInteger(supplierId) ? supplierId : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supplierId = await parseId(params)
    if (!supplierId) {
      return NextResponse.json({ error: "Invalid SupplierID" }, { status: 400 })
    }

    const supplier = await prisma.supplier.findUnique({
      where: { supplierId },
      include: {
        products: {
          orderBy: [{ productId: "asc" }],
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error("[SUPPLIER_BY_ID_GET]", error)
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supplierId = await parseId(params)
    if (!supplierId) {
      return NextResponse.json({ error: "Invalid SupplierID" }, { status: 400 })
    }

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

    const hasProductsPayload = Array.isArray(body.products)
    const products = hasProductsPayload ? normalizeProducts(body.products) : []

    const updated = await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { supplierId },
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

      // Update/create products without bulk delete so FK-linked purchase rows remain valid.
      if (hasProductsPayload) {
        for (const item of products) {
          const commonData = {
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
          }

          if (item.productId) {
            const updatedRows = await tx.product.updateMany({
              where: {
                productId: item.productId,
                supplierId,
              },
              data: commonData,
            })

            if (updatedRows.count === 0) {
              await tx.product.create({
                data: {
                  supplierId,
                  ...commonData,
                },
              })
            }
          } else {
            await tx.product.create({
              data: {
                supplierId,
                ...commonData,
              },
            })
          }
        }
      }

      return tx.supplier.findUnique({
        where: { supplierId },
        include: {
          products: {
            orderBy: [{ productId: "asc" }],
          },
        },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[SUPPLIER_BY_ID_PUT]", error)
    return NextResponse.json(
      {
        error: "Failed to update supplier",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supplierId = await parseId(params)
    if (!supplierId) {
      return NextResponse.json({ error: "Invalid SupplierID" }, { status: 400 })
    }

    const existing = await prisma.supplier.findUnique({ where: { supplierId } })
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    // Prevent data loss/corruption: products used in purchases/sales cannot be deleted safely.
    const supplierProducts = await prisma.product.findMany({
      where: { supplierId },
      select: {
        productId: true,
        productName: true,
        _count: {
          select: {
            purchaseDetails: true,
            saleDetails: true,
          },
        },
      },
    })

    const referencedProducts = supplierProducts.filter(
      (product) => (product._count.purchaseDetails || 0) > 0 || (product._count.saleDetails || 0) > 0
    )

    if (referencedProducts.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete supplier because some products are used in purchase/sales history. Remove dependent transactions first.",
          referencedProducts: referencedProducts.map((product) => ({
            productId: product.productId,
            productName: product.productName,
            purchaseDetailsCount: product._count.purchaseDetails,
            saleDetailsCount: product._count.saleDetails,
          })),
        },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.deleteMany({ where: { supplierId } })
      await tx.supplier.delete({ where: { supplierId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[SUPPLIER_BY_ID_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 })
  }
}
