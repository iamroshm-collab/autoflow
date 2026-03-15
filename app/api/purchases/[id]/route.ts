import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value
  const text = String(value || "").toLowerCase()
  return text === "yes" || text === "true" || text === "1"
}

const calculatePurchaseLine = (line: any) => {
  const qnty = Number(line.qnty || 0)
  const purchasePrice = Number(line.purchasePrice || 0)
  const amount = qnty * purchasePrice
  const sgstRate = Number(line.sgstRate || 0)
  const cgstRate = Number(line.cgstRate || 0)
  const sgstAmount = (amount * sgstRate) / 100
  const cgstAmount = (amount * cgstRate) / 100
  const igstAmount = Number(line.igstAmount || 0)
  const totalAmount = amount + sgstAmount + cgstAmount + igstAmount

  return {
    qnty,
    purchasePrice,
    amount,
    sgstRate,
    cgstRate,
    sgstAmount,
    cgstAmount,
    igstAmount,
    totalAmount,
  }
}

const getPurchaseId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  const purchaseId = Number(id)
  return Number.isInteger(purchaseId) ? purchaseId : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const purchaseId = await getPurchaseId(params)
    if (!purchaseId) {
      return NextResponse.json({ error: "Invalid PurchaseID" }, { status: 400 })
    }

    const purchase = await prismaClient.purchase.findUnique({
      where: { purchaseId },
      include: {
        purchaseDetails: {
          orderBy: { purchaseDetailsId: "asc" },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 })
    }

    return NextResponse.json(purchase)
  } catch (error) {
    console.error("[PURCHASE_ID_GET]", error)
    return NextResponse.json({ error: "Failed to fetch purchase" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const purchaseId = await getPurchaseId(params)
    if (!purchaseId) {
      return NextResponse.json({ error: "Invalid PurchaseID" }, { status: 400 })
    }

    const body = await request.json()
    const supplierId = Number(body.supplierId)
    const purchaseDate = new Date(body.purchaseDate)
    const details = Array.isArray(body.details) ? body.details : []

    if (!Number.isInteger(supplierId) || Number.isNaN(purchaseDate.getTime())) {
      return NextResponse.json(
        { error: "SupplierID and PurchaseDate are required" },
        { status: 400 }
      )
    }

    const updated = await prismaClient.$transaction(async (tx: any) => {
      const existing = await tx.purchase.findUnique({
        where: { purchaseId },
        include: {
          purchaseDetails: true,
        },
      })

      if (!existing) {
        throw new Error("Purchase not found")
      }

      for (const oldLine of existing.purchaseDetails) {
        const product = await tx.product.findUnique({ where: { productId: oldLine.productId } })
        if (product) {
          const nextBalance = Number(product.balanceStock || 0) - Number(oldLine.qnty || 0)
          await tx.product.update({
            where: { productId: oldLine.productId },
            data: {
              balanceStock: Math.max(0, nextBalance),
            },
          })
        }
      }

      await tx.purchase.update({
        where: { purchaseId },
        data: {
          purchaseDate,
          supplierId,
          supplier: body.supplier || existing.supplier,
          address: body.address || null,
          mobileNo: body.mobileNo || null,
          gstin: body.gstin || null,
          pan: body.pan || null,
          stateId: body.stateId || null,
          refDocument: body.refDocument || null,
          taxable: toBoolean(body.taxable),
        },
      })

      await tx.purchaseDetail.deleteMany({ where: { purchaseId } })

      for (const item of details) {
        const productId = Number(item.productId)
        if (!Number.isInteger(productId)) {
          throw new Error("Invalid ProductID in purchase details")
        }

        const product = await tx.product.findUnique({ where: { productId } })
        if (!product) {
          throw new Error(`Product ${productId} not found`)
        }

        const calc = calculatePurchaseLine(item)

        await tx.purchaseDetail.create({
          data: {
            purchaseId,
            productId,
            product: item.product || product.productName,
            productDescription: item.productDescription || product.productDescription || null,
            hsn: item.hsn || product.hsnCode || null,
            qnty: calc.qnty,
            unit: item.unit || product.unit || null,
            purchasePrice: calc.purchasePrice,
            mrp: Number(item.mrp ?? product.mrp ?? 0),
            salePrice: Number(item.salePrice ?? product.salePrice ?? 0),
            sgstRate: calc.sgstRate,
            cgstRate: calc.cgstRate,
            amount: calc.amount,
            sgstAmount: calc.sgstAmount,
            cgstAmount: calc.cgstAmount,
            igstAmount: calc.igstAmount,
            totalAmount: calc.totalAmount,
            balanceStock: calc.qnty,
          },
        })

        await tx.product.update({
          where: { productId },
          data: {
            balanceStock: Number(product.balanceStock || 0) + calc.qnty,
            purchasePrice: calc.purchasePrice,
            mrp: Number(item.mrp ?? product.mrp ?? 0),
            salePrice: Number(item.salePrice ?? product.salePrice ?? 0),
            sgstRate: calc.sgstRate,
            cgstRate: calc.cgstRate,
          },
        })
      }

      return tx.purchase.findUnique({
        where: { purchaseId },
        include: {
          purchaseDetails: {
            orderBy: { purchaseDetailsId: "asc" },
          },
        },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PURCHASE_ID_PUT]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update purchase" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const purchaseId = await getPurchaseId(params)
    if (!purchaseId) {
      return NextResponse.json({ error: "Invalid PurchaseID" }, { status: 400 })
    }

    await prismaClient.$transaction(async (tx: any) => {
      const existing = await tx.purchase.findUnique({
        where: { purchaseId },
        include: { purchaseDetails: true },
      })

      if (!existing) {
        throw new Error("Purchase not found")
      }

      for (const oldLine of existing.purchaseDetails) {
        const product = await tx.product.findUnique({ where: { productId: oldLine.productId } })
        if (product) {
          const nextBalance = Number(product.balanceStock || 0) - Number(oldLine.qnty || 0)
          await tx.product.update({
            where: { productId: oldLine.productId },
            data: {
              balanceStock: Math.max(0, nextBalance),
            },
          })
        }
      }

      await tx.purchase.delete({ where: { purchaseId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[PURCHASE_ID_DELETE]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete purchase" },
      { status: 500 }
    )
  }
}
