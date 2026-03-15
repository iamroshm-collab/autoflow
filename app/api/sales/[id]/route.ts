import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value
  const text = String(value || "").toLowerCase()
  return text === "yes" || text === "true" || text === "1"
}

const calculateSaleLine = (line: any) => {
  const qnty = Number(line.qnty || 0)
  const returnQnty = Number(line.returnQnty || 0)
  const salePrice = Number(line.salePrice || 0)
  const amount = qnty * salePrice
  const discount = Number(line.discount || 0)
  const discountAmount = (amount * discount) / 100
  const accessAmount = amount - discountAmount
  const sgstRate = Number(line.sgstRate || 0)
  const cgstRate = Number(line.cgstRate || 0)
  const igstRate = Number(line.igstRate || 0)
  const sgstAmount = (accessAmount * sgstRate) / 100
  const cgstAmount = (accessAmount * cgstRate) / 100
  const igstAmount = (accessAmount * igstRate) / 100
  const totalAmount = accessAmount + sgstAmount + cgstAmount + igstAmount

  return {
    qnty,
    returnQnty,
    salePrice,
    amount,
    discount,
    discountAmount,
    accessAmount,
    sgstRate,
    cgstRate,
    igstRate,
    sgstAmount,
    cgstAmount,
    igstAmount,
    totalAmount,
    stockOut: qnty - returnQnty,
  }
}

const getSaleId = async (params: Promise<{ id: string }>) => {
  const { id } = await params
  const saleId = Number(id)
  return Number.isInteger(saleId) ? saleId : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const saleId = await getSaleId(params)
    if (!saleId) {
      return NextResponse.json({ error: "Invalid SaleID" }, { status: 400 })
    }

    const sale = await prismaClient.sale.findUnique({
      where: { saleId },
      include: {
        saleDetails: {
          orderBy: { saleDetailsId: "asc" },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 })
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error("[SALE_ID_GET]", error)
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const saleId = await getSaleId(params)
    if (!saleId) {
      return NextResponse.json({ error: "Invalid SaleID" }, { status: 400 })
    }

    const body = await request.json()
    const details = Array.isArray(body.details) ? body.details : []
    const billDate = new Date(body.billDate)

    if (!body.billNumber || !body.customer || Number.isNaN(billDate.getTime())) {
      return NextResponse.json(
        { error: "BillNumber, Customer and BillDate are required" },
        { status: 400 }
      )
    }

    const updated = await prismaClient.$transaction(async (tx: any) => {
      const existing = await tx.sale.findUnique({
        where: { saleId },
        include: { saleDetails: true },
      })

      if (!existing) {
        throw new Error("Sale not found")
      }

      for (const oldLine of existing.saleDetails) {
        const product = await tx.product.findUnique({ where: { productId: oldLine.productId } })
        if (product) {
          const oldStockOut = Number(oldLine.qnty || 0) - Number(oldLine.returnQnty || 0)
          await tx.product.update({
            where: { productId: oldLine.productId },
            data: {
              balanceStock: Number(product.balanceStock || 0) + oldStockOut,
            },
          })
        }
      }

      await tx.sale.update({
        where: { saleId },
        data: {
          vehicleId: body.vehicleId || null,
          categoryId: body.categoryId || null,
          billNumber: String(body.billNumber),
          prefix: body.prefix || null,
          billDate,
          customer: String(body.customer),
          address: body.address || null,
          mobileNo: body.mobileNo || null,
          vehicleReg: body.vehicleReg || null,
          billType: body.billType || null,
          saleType: body.saleType || null,
          despatchTime: body.despatchTime ? new Date(body.despatchTime) : null,
          gstin: body.gstin || null,
          stateCode: body.stateCode || null,
          taxable: toBoolean(body.taxable),
        },
      })

      await tx.saleDetail.deleteMany({ where: { saleId } })

      for (const item of details) {
        const productId = Number(item.productId)
        if (!Number.isInteger(productId)) {
          throw new Error("Invalid ProductID in sale details")
        }

        const product = await tx.product.findUnique({ where: { productId } })
        if (!product) {
          throw new Error(`Product ${productId} not found`)
        }

        const calc = calculateSaleLine(item)
        if (calc.stockOut < 0) {
          throw new Error("Return quantity cannot exceed sold quantity")
        }

        const available = Number(product.balanceStock || 0)
        if (calc.stockOut > available) {
          throw new Error(`Insufficient stock for ${product.productName}`)
        }

        await tx.saleDetail.create({
          data: {
            saleId,
            productId,
            product: item.product || product.productName,
            productDescription: item.productDescription || product.productDescription || null,
            purchasePrice: Number(item.purchasePrice ?? product.purchasePrice ?? 0),
            purchaseDetailsId: item.purchaseDetailsId ? Number(item.purchaseDetailsId) : null,
            hsn: item.hsn || product.hsnCode || null,
            salePrice: calc.salePrice,
            unit: item.unit || product.unit || null,
            qnty: calc.qnty,
            returnQnty: calc.returnQnty,
            returnDate: item.returnDate ? new Date(item.returnDate) : null,
            discount: calc.discount,
            sgstRate: calc.sgstRate,
            cgstRate: calc.cgstRate,
            amount: calc.amount,
            discountAmount: calc.discountAmount,
            accessAmount: calc.accessAmount,
            sgstAmount: calc.sgstAmount,
            cgstAmount: calc.cgstAmount,
            igstRate: calc.igstRate,
            igstAmount: calc.igstAmount,
            totalAmount: calc.totalAmount,
          },
        })

        await tx.product.update({
          where: { productId },
          data: {
            balanceStock: available - calc.stockOut,
          },
        })
      }

      return tx.sale.findUnique({
        where: { saleId },
        include: {
          saleDetails: {
            orderBy: { saleDetailsId: "asc" },
          },
        },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[SALE_ID_PUT]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sale" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const saleId = await getSaleId(params)
    if (!saleId) {
      return NextResponse.json({ error: "Invalid SaleID" }, { status: 400 })
    }

    await prismaClient.$transaction(async (tx: any) => {
      const existing = await tx.sale.findUnique({
        where: { saleId },
        include: { saleDetails: true },
      })

      if (!existing) {
        throw new Error("Sale not found")
      }

      for (const oldLine of existing.saleDetails) {
        const product = await tx.product.findUnique({ where: { productId: oldLine.productId } })
        if (product) {
          const oldStockOut = Number(oldLine.qnty || 0) - Number(oldLine.returnQnty || 0)
          await tx.product.update({
            where: { productId: oldLine.productId },
            data: {
              balanceStock: Number(product.balanceStock || 0) + oldStockOut,
            },
          })
        }
      }

      await tx.sale.delete({ where: { saleId } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[SALE_ID_DELETE]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sale" },
      { status: 500 }
    )
  }
}
