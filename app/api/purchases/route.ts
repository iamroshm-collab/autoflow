import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateGST } from "@/services/gstCalculator"

const prismaClient = prisma as any

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value
  const text = String(value || "").toLowerCase()
  return text === "yes" || text === "true" || text === "1"
}

const sanitizeGstin = (value?: string | null) => {
  const trimmed = (value || "").trim()
  return trimmed.length ? trimmed.toUpperCase() : null
}

const ensureBranch = async (tx: any, branchId?: number | null) => {
  if (branchId) {
    const branch = await tx.branch.findUnique({ where: { id: branchId } })
    if (branch) return branch
  }

  const existing = await tx.branch.findFirst()
  if (existing) return existing

  return tx.branch.create({
    data: {
      branchName: "Default Branch",
      stateCode: "00",
      gstin: "NA0000000000000",
    },
  })
}

const derivePlaceOfSupply = (body: any, supplier: any, branch: any) =>
  body.placeOfSupplyStateCode || supplier?.stateCode || branch.stateCode

const deriveInvoiceType = (requested: string | undefined, gstin: string | null) =>
  requested || (gstin ? "B2B" : "B2C")

const deriveGstPercent = (line: any, product: any) => {
  const inline = Number(line.gstPercent)
  if (!Number.isNaN(inline) && inline > 0) return inline
  const productRate = Number(product?.gstPercent || 0)
  if (productRate > 0) return productRate
  const splitSum = Number(product?.cgstRate || 0) + Number(product?.sgstRate || 0) + Number(product?.igstRate || 0)
  return splitSum || 0
}

const calculatePurchaseLine = (
  line: any,
  product: any,
  branchStateCode: string,
  placeOfSupplyStateCode: string,
) => {
  const qnty = Number(line.qnty || 0)
  const purchasePrice = Number(line.purchasePrice || 0)
  const gstPercent = deriveGstPercent(line, product)
  const isInclusive = Boolean(line.isInclusive ?? product?.isInclusive)

  const calc = calculateGST({
    branchStateCode,
    placeOfSupplyStateCode,
    taxableValue: qnty * purchasePrice,
    gstPercent,
    isInclusive,
  })

  return {
    qnty,
    purchasePrice,
    gstPercent,
    isInclusive,
    taxableValue: calc.taxableValue,
    sgstRate: calc.appliedRates.sgstRate,
    cgstRate: calc.appliedRates.cgstRate,
    igstRate: calc.appliedRates.igstRate,
    sgstAmount: calc.sgstAmount,
    cgstAmount: calc.cgstAmount,
    igstAmount: calc.igstAmount,
    totalAmount: calc.lineTotal,
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim()
    const bill = request.nextUrl.searchParams.get("bill")?.trim()

    if (id) {
      const purchaseId = Number(id)
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
    }

    // search by bill number or reference document
    if (bill) {
      const rows = await prismaClient.purchase.findMany({
        where: {
          OR: [
            { refDocument: { contains: bill } },
            { billNumber: { contains: bill } },
          ],
        },
        include: {
          supplierMaster: {
            select: {
              supplierName: true,
            },
          },
          purchaseDetails: {
            select: {
              purchaseDetailsId: true,
              productId: true,
              product: true,
              qnty: true,
              totalAmount: true,
              purchasePrice: true,
            },
          },
        },
        orderBy: [{ purchaseDate: "desc" }, { purchaseId: "desc" }],
        take: 100,
      })

      return NextResponse.json(rows)
    }

    const rows = await prismaClient.purchase.findMany({
      include: {
        supplierMaster: {
          select: {
            supplierName: true,
          },
        },
        purchaseDetails: {
          select: {
            purchaseDetailsId: true,
            productId: true,
            product: true,
            qnty: true,
            purchasePrice: true,
            totalAmount: true,
          },
        },
      },
      orderBy: [{ purchaseDate: "desc" }, { purchaseId: "desc" }],
      take: 100,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[PURCHASES_GET]", error)
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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

    if (details.length === 0) {
      return NextResponse.json(
        { error: "At least one purchase detail row is required" },
        { status: 400 }
      )
    }

    const created = await prismaClient.$transaction(async (tx: any) => {
      const supplier = await tx.supplier.findUnique({ where: { supplierId } })
      if (!supplier) {
        throw new Error("Supplier not found")
      }

      const branch = await ensureBranch(tx, body.branchId)
      const supplierGstin = sanitizeGstin(body.gstin || supplier.gstin)
      const invoiceType = deriveInvoiceType(body.invoiceType, supplierGstin)

      if (invoiceType === "B2B") {
        if (!supplierGstin || !GSTIN_REGEX.test(supplierGstin)) {
          throw new Error("Valid supplier GSTIN required for B2B invoices")
        }
      }

      // Prevent duplicate purchases by bill number (per-item `billNumber` or top-level `refDocument`) and productId
      const topLevelRef = body.billNumber ? String(body.billNumber).trim() : (body.refDocument ? String(body.refDocument).trim() : '')
      for (const item of details) {
        const productIdCheck = Number(item.productId)
        if (!Number.isInteger(productIdCheck)) {
          throw new Error("Invalid ProductID in purchase details")
        }

        const itemBill = item.billNumber ? String(item.billNumber).trim() : topLevelRef
        if (!itemBill) continue // no bill number to check against

        const existingDetail = await tx.purchaseDetail.findFirst({
          where: {
            productId: productIdCheck,
            purchase: { refDocument: itemBill },
          },
          select: { purchaseDetailsId: true },
        })

        if (existingDetail) {
          throw new Error(`Duplicate purchase: product ${productIdCheck} already exists for bill ${itemBill}`)
        }
      }

      const placeOfSupplyStateCode = derivePlaceOfSupply(body, supplier, branch)

      const purchase = await tx.purchase.create({
        data: {
          purchaseDate,
          supplierId,
          branchId: branch.id,
          supplier: body.supplier || supplier.supplierName,
          address: body.address || supplier.address || null,
          mobileNo: body.mobileNo || supplier.mobileNo || null,
          gstin: body.gstin || supplier.gstin || null,
          supplierGstin,
          pan: body.pan || supplier.pan || null,
          stateId: body.stateId || supplier.stateCode || null,
          placeOfSupplyStateCode,
          refDocument: body.billNumber || body.refDocument || null,
          taxable: toBoolean(body.taxable),
          invoiceType,
        },
      })

      const totals = {
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        grand: 0,
      }

      for (const item of details) {
        const productId = Number(item.productId)
        if (!Number.isInteger(productId)) {
          throw new Error("Invalid ProductID in purchase details")
        }

        const product = await tx.product.findUnique({ where: { productId } })
        if (!product) {
          throw new Error(`Product ${productId} not found`)
        }

        const calc = calculatePurchaseLine(item, product, branch.stateCode, placeOfSupplyStateCode)
        const hsn = item.hsn || product.hsnCode || null
        if (calc.gstPercent > 0 && !hsn) {
          throw new Error("HSN is required for taxable products")
        }

        // If a detail for this product already exists on the purchase, merge quantities and amounts
        const existingDetail = await tx.purchaseDetail.findFirst({ where: { purchaseId: purchase.purchaseId, productId } })
        if (existingDetail) {
          const updatedQnty = Number(existingDetail.qnty || 0) + calc.qnty
          const updatedTaxable = Number(existingDetail.taxableValue || 0) + calc.taxableValue
          const updatedSgst = Number(existingDetail.sgstAmount || 0) + calc.sgstAmount
          const updatedCgst = Number(existingDetail.cgstAmount || 0) + calc.cgstAmount
          const updatedIgst = Number(existingDetail.igstAmount || 0) + calc.igstAmount
          const updatedTotal = Number(existingDetail.totalAmount || 0) + calc.totalAmount
          const updatedBalance = Number(existingDetail.balanceStock || 0) + calc.qnty

          await tx.purchaseDetail.update({
            where: { purchaseDetailsId: existingDetail.purchaseDetailsId },
            data: {
              qnty: updatedQnty,
              taxableValue: updatedTaxable,
              gstPercent: calc.gstPercent,
              sgstRate: calc.sgstRate,
              cgstRate: calc.cgstRate,
              sgstAmount: updatedSgst,
              cgstAmount: updatedCgst,
              igstAmount: updatedIgst,
              totalAmount: updatedTotal,
              balanceStock: updatedBalance,
              hsn,
            },
          })
        } else {
          await tx.purchaseDetail.create({
            data: {
              purchaseId: purchase.purchaseId,
              productId,
              product: item.product || product.productName,
              productDescription: item.productDescription || product.productDescription || null,
              hsn,
              gstPercent: calc.gstPercent,
              taxableValue: calc.taxableValue,
              qnty: calc.qnty,
              unit: item.unit || product.unit || null,
              purchasePrice: calc.purchasePrice,
              mrp: Number(item.mrp ?? product.mrp ?? 0),
              salePrice: Number(item.salePrice ?? product.salePrice ?? 0),
              sgstRate: calc.sgstRate,
              cgstRate: calc.cgstRate,
              amount: calc.taxableValue,
              sgstAmount: calc.sgstAmount,
              cgstAmount: calc.cgstAmount,
              igstAmount: calc.igstAmount,
              totalAmount: calc.totalAmount,
              balanceStock: calc.qnty,
            },
          })
        }

        totals.taxable += calc.taxableValue
        totals.cgst += calc.cgstAmount
        totals.sgst += calc.sgstAmount
        totals.igst += calc.igstAmount
        totals.grand += calc.totalAmount

        await tx.product.update({
          where: { productId },
          data: {
            balanceStock: Number(product.balanceStock || 0) + calc.qnty,
            purchasePrice: calc.purchasePrice,
            mrp: Number(item.mrp ?? product.mrp ?? 0),
            salePrice: Number(item.salePrice ?? product.salePrice ?? 0),
            sgstRate: calc.sgstRate,
            cgstRate: calc.cgstRate,
            igstRate: calc.igstRate,
            gstPercent: calc.gstPercent,
            isTaxable: calc.gstPercent > 0,
            isInclusive: calc.isInclusive,
          },
        })
      }

      await tx.purchase.update({
        where: { purchaseId: purchase.purchaseId },
        data: {
          totalTaxableAmount: totals.taxable,
          totalCgst: totals.cgst,
          totalSgst: totals.sgst,
          totalIgst: totals.igst,
          grandTotal: totals.grand,
        },
      })

      await tx.itcLedger.create({
        data: {
          branchId: branch.id,
          sourceType: "purchase",
          sourceId: purchase.purchaseId,
          igstCredit: totals.igst,
          cgstCredit: totals.cgst,
          sgstCredit: totals.sgst,
          balanceIgst: totals.igst,
          balanceCgst: totals.cgst,
          balanceSgst: totals.sgst,
        },
      })

      return tx.purchase.findUnique({
        where: { purchaseId: purchase.purchaseId },
        include: {
          purchaseDetails: {
            orderBy: { purchaseDetailsId: "asc" },
          },
        },
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("[PURCHASES_POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create purchase" },
      { status: 500 }
    )
  }
}
