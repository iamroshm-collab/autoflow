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

const derivePlaceOfSupply = (body: any, branch: any) =>
  body.placeOfSupplyStateCode || body.stateCode || branch.stateCode

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

const calculateSaleLine = (
  line: any,
  product: any,
  branchStateCode: string,
  placeOfSupplyStateCode: string,
) => {
  const qnty = Number(line.qnty || 0)
  const returnQnty = Number(line.returnQnty || 0)
  const salePrice = Number(line.salePrice || 0)
  const discount = Number(line.discount || 0)
  const amount = qnty * salePrice
  const discountAmount = (amount * discount) / 100
  const base = amount - discountAmount
  const gstPercent = deriveGstPercent(line, product)
  const isInclusive = Boolean(line.isInclusive ?? product?.isInclusive)

  const calc = calculateGST({
    branchStateCode,
    placeOfSupplyStateCode,
    taxableValue: base,
    gstPercent,
    isInclusive,
  })

  return {
    qnty,
    returnQnty,
    salePrice,
    discount,
    discountAmount,
    taxableValue: calc.taxableValue,
    gstPercent,
    isInclusive,
    sgstRate: calc.appliedRates.sgstRate,
    cgstRate: calc.appliedRates.cgstRate,
    igstRate: calc.appliedRates.igstRate,
    sgstAmount: calc.sgstAmount,
    cgstAmount: calc.cgstAmount,
    igstAmount: calc.igstAmount,
    totalAmount: calc.lineTotal,
    stockOut: qnty - returnQnty,
  }
}

export async function GET(request: NextRequest) {
  try {
    // summary endpoint: /api/sales?summary=1
    const summaryFlag = request.nextUrl.searchParams.get("summary")
    if (summaryFlag && ['1', 'true', 'yes'].includes(String(summaryFlag).toLowerCase())) {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const end = new Date(start)
      end.setDate(end.getDate() + 1)

      // Today's sales count
      const todaysSales = await prismaClient.sale.count({ where: { billDate: { gte: start, lt: end } } })

      // Total customers (count of customers table)
      const totalCustomers = await prismaClient.customer.count()

      // Returns (sum of returnQnty for saleDetails where sale billDate is today)
      const returnsAgg: any = await prismaClient.saleDetail.aggregate({
        _sum: { returnQnty: true },
        where: { sale: { billDate: { gte: start, lt: end } } },
      })
      const returns = Number(returnsAgg._sum?.returnQnty || 0)

      // Total revenue (sum of totalAmount for saleDetails today)
      const revenueAgg: any = await prismaClient.saleDetail.aggregate({
        _sum: { totalAmount: true },
        where: { sale: { billDate: { gte: start, lt: end } } },
      })
      const totalRevenue = Number(revenueAgg._sum?.totalAmount || 0)

      return NextResponse.json({
        todaysSales,
        totalCustomers,
        returns,
        totalRevenue,
      })
    }
    const id = request.nextUrl.searchParams.get("id")?.trim()
    const bill = request.nextUrl.searchParams.get("bill")?.trim()

    if (id) {
      const saleId = Number(id)
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
    }
    // search by bill number
    if (bill) {
      const rows = await prismaClient.sale.findMany({
        where: { billNumber: { contains: bill } },
        include: {
          saleDetails: {
            select: {
              saleDetailsId: true,
              productId: true,
              product: true,
              qnty: true,
              totalAmount: true,
              salePrice: true,
            },
          },
        },
        orderBy: [{ billDate: "desc" }, { saleId: "desc" }],
        take: 100,
      })

      return NextResponse.json(rows)
    }

    const rows = await prismaClient.sale.findMany({
      include: {
        saleDetails: {
          select: {
            saleDetailsId: true,
            product: true,
            qnty: true,
            totalAmount: true,
          },
        },
      },
      orderBy: [{ billDate: "desc" }, { saleId: "desc" }],
      take: 100,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[SALES_GET]", error)
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const details = Array.isArray(body.details) ? body.details : []
    const billDate = new Date(body.billDate)

    if (!body.customer || Number.isNaN(billDate.getTime())) {
      return NextResponse.json(
        { error: "Customer and BillDate are required" },
        { status: 400 }
      )
    }

    if (details.length === 0) {
      return NextResponse.json(
        { error: "At least one sale detail row is required" },
        { status: 400 }
      )
    }

    const created = await prismaClient.$transaction(async (tx: any) => {
      const branch = await ensureBranch(tx, body.branchId)
      const customerGstin = sanitizeGstin(body.gstin || body.customerGstin)
      const invoiceType = deriveInvoiceType(body.invoiceType, customerGstin)

      if (invoiceType === "B2B") {
        if (!customerGstin || !GSTIN_REGEX.test(customerGstin)) {
          throw new Error("Valid customer GSTIN required for B2B invoices")
        }
      }

      // generate bill number if not provided: format INVYYYYMMDD-XXXX (daily sequence)
      let billNumberToUse = body.billNumber && String(body.billNumber).trim() ? String(body.billNumber).trim() : ''
      if (!billNumberToUse) {
        const start = new Date(billDate.getFullYear(), billDate.getMonth(), billDate.getDate())
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        const todaysCount = await tx.sale.count({ where: { billDate: { gte: start, lt: end } } })
        const seq = todaysCount + 1
        const yyyy = String(start.getFullYear())
        const mm = String(start.getMonth() + 1).padStart(2, '0')
        const dd = String(start.getDate()).padStart(2, '0')
        billNumberToUse = `INV${yyyy}${mm}${dd}-${String(seq).padStart(4, '0')}`
      }

      const placeOfSupplyStateCode = derivePlaceOfSupply(body, branch)

      const sale = await tx.sale.create({
        data: {
          branchId: branch.id,
          vehicleId: body.vehicleId || null,
          categoryId: body.categoryId || null,
          billNumber: billNumberToUse,
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
          customerGstin,
          stateCode: body.stateCode || null,
          placeOfSupplyStateCode,
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
          throw new Error("Invalid ProductID in sale details")
        }

        const product = await tx.product.findUnique({ where: { productId } })
        if (!product) {
          throw new Error(`Product ${productId} not found`)
        }

        const calc = calculateSaleLine(item, product, branch.stateCode, placeOfSupplyStateCode)
        if (calc.stockOut < 0) {
          throw new Error("Return quantity cannot exceed sold quantity")
        }

        if (calc.gstPercent > 0 && !(item.hsn || product.hsnCode)) {
          throw new Error("HSN is required for taxable products")
        }

        const available = Number(product.balanceStock || 0)
        if (calc.stockOut > available) {
          throw new Error(`Insufficient stock for ${product.productName}`)
        }

        await tx.saleDetail.create({
          data: {
            saleId: sale.saleId,
            productId,
            product: item.product || product.productName,
            productDescription: item.productDescription || product.productDescription || null,
            purchasePrice: Number(item.purchasePrice ?? product.purchasePrice ?? 0),
            purchaseDetailsId: item.purchaseDetailsId ? Number(item.purchaseDetailsId) : null,
            hsn: item.hsn || product.hsnCode || null,
            gstPercent: calc.gstPercent,
            taxableValue: calc.taxableValue,
            salePrice: calc.salePrice,
            unit: item.unit || product.unit || null,
            qnty: calc.qnty,
            returnQnty: calc.returnQnty,
            returnDate: item.returnDate ? new Date(item.returnDate) : null,
            discount: calc.discount,
            sgstRate: calc.sgstRate,
            cgstRate: calc.cgstRate,
            igstRate: calc.igstRate,
            discountAmount: calc.discountAmount,
            sgstAmount: calc.sgstAmount,
            cgstAmount: calc.cgstAmount,
            igstAmount: calc.igstAmount,
            totalAmount: calc.totalAmount,
          },
        })

        totals.taxable += calc.taxableValue
        totals.cgst += calc.cgstAmount
        totals.sgst += calc.sgstAmount
        totals.igst += calc.igstAmount
        totals.grand += calc.totalAmount

        await tx.product.update({
          where: { productId },
          data: {
            balanceStock: available - calc.stockOut,
            gstPercent: calc.gstPercent,
            sgstRate: calc.sgstRate,
            cgstRate: calc.cgstRate,
            igstRate: calc.igstRate,
            isTaxable: calc.gstPercent > 0,
            isInclusive: calc.isInclusive,
          },
        })
      }

      await tx.sale.update({
        where: { saleId: sale.saleId },
        data: {
          totalTaxableAmount: totals.taxable,
          totalCgst: totals.cgst,
          totalSgst: totals.sgst,
          totalIgst: totals.igst,
          grandTotal: totals.grand,
        },
      })

      return tx.sale.findUnique({
        where: { saleId: sale.saleId },
        include: {
          saleDetails: {
            orderBy: { saleDetailsId: "asc" },
          },
        },
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("[SALES_POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sale" },
      { status: 500 }
    )
  }
}
