import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

type StockReportRow = {
  productId: number
  productName: string
  supplierId: number
  supplierName: string
  categoryId: string
  totalPurchased: number
  totalSold: number
  totalReturned: number
  currentBalance: number
  productMasterBalance: number
}

type StockReportSummary = {
  totalPurchased: number
  totalSold: number
  totalReturned: number
  currentBalance: number
}

export async function GET(request: NextRequest) {
  try {
    const categoryId = request.nextUrl.searchParams.get("categoryId")?.trim() || ""
    const supplierIdRaw = request.nextUrl.searchParams.get("supplierId")?.trim() || ""
    const supplierId = supplierIdRaw ? Number(supplierIdRaw) : null

    const products = await prismaClient.product.findMany({
      where: {
        categoryId: categoryId || undefined,
        supplierId: Number.isInteger(supplierId) ? supplierId : undefined,
      },
      include: {
        supplier: {
          select: {
            supplierId: true,
            supplierName: true,
          },
        },
      },
      orderBy: [{ productName: "asc" }],
    })

    const productIds = products.map((item: any) => item.productId)

    // Use aggregation queries instead of loading all records
    const [purchaseAggregates, saleAggregates] = await Promise.all([
      productIds.length > 0 ? prismaClient.$queryRaw<Array<{ productId: number; totalQnty: number }>>`
        SELECT productId, SUM(CAST(qnty AS DECIMAL(18,2))) as totalQnty
        FROM PurchaseDetails
        WHERE productId IN (${prismaClient.Prisma.join(productIds)})
        GROUP BY productId
      ` : Promise.resolve([]),
      productIds.length > 0 ? prismaClient.$queryRaw<Array<{ productId: number; totalQnty: number; totalReturn: number }>>`
        SELECT 
          productId, 
          SUM(CAST(qnty AS DECIMAL(18,2))) as totalQnty,
          SUM(CAST(ISNULL(returnQnty, 0) AS DECIMAL(18,2))) as totalReturn
        FROM SaleDetails
        WHERE productId IN (${prismaClient.Prisma.join(productIds)})
        GROUP BY productId
      ` : Promise.resolve([])
    ])

    const purchasedMap = new Map<number, number>()
    const soldMap = new Map<number, number>()
    const returnedMap = new Map<number, number>()

    for (const row of purchaseAggregates) {
      purchasedMap.set(row.productId, Number(row.totalQnty || 0))
    }

    for (const row of saleAggregates) {
      soldMap.set(row.productId, Number(row.totalQnty || 0))
      returnedMap.set(row.productId, Number(row.totalReturn || 0))
    }

    const rows: StockReportRow[] = products.map((product: any) => {
      const totalPurchased = purchasedMap.get(product.productId) || 0
      const totalSold = soldMap.get(product.productId) || 0
      const totalReturned = returnedMap.get(product.productId) || 0
      const computedBalance = totalPurchased - totalSold - totalReturned

      return {
        productId: product.productId,
        productName: product.productName,
        supplierId: product.supplierId,
        supplierName: product.supplier?.supplierName || "",
        categoryId: product.categoryId || "",
        totalPurchased,
        totalSold,
        totalReturned,
        currentBalance: computedBalance,
        productMasterBalance: Number(product.balanceStock || 0),
      }
    })

    const summary = rows.reduce<StockReportSummary>(
      (acc, row) => {
        acc.totalPurchased += row.totalPurchased
        acc.totalSold += row.totalSold
        acc.totalReturned += row.totalReturned
        acc.currentBalance += row.currentBalance
        return acc
      },
      {
        totalPurchased: 0,
        totalSold: 0,
        totalReturned: 0,
        currentBalance: 0,
      }
    )

    return NextResponse.json({ rows, summary })
  } catch (error) {
    console.error("[STOCK_REPORT_GET]", error)
    return NextResponse.json({ error: "Failed to fetch stock report" }, { status: 500 })
  }
}
