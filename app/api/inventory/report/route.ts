import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get all products with their purchase and sale history
    const products = await prisma.product.findMany({
      include: {
        purchaseDetails: true,
        saleDetails: true,
        supplier: {
          select: {
            supplierName: true,
          },
        },
        category: {
          select: {
            categoryName: true,
          },
        },
      },
    })

    // Calculate stock movements for each product
    const report = products.map((product) => {
      const totalPurchased = product.purchaseDetails.reduce((sum, pd) => sum + pd.qnty, 0)
      const totalSold = product.saleDetails.reduce((sum, sd) => sum + sd.qnty, 0)
      const totalReturned = product.saleDetails.reduce((sum, sd) => sum + sd.returnQnty, 0)
      const currentBalance = totalPurchased - totalSold + totalReturned
      const balanceValue = currentBalance * (product.purchasePrice || 0)

      return {
        productId: product.productId,
        productName: product.productName,
        category: product.category?.categoryName || 'Uncategorized',
        supplier: product.supplier?.supplierName || 'Unknown Supplier',
        unit: product.unit || 'Pcs',
        totalPurchased,
        totalSold,
        totalReturned,
        currentBalance: currentBalance > 0 ? currentBalance : 0,
        purchasePrice: product.purchasePrice || 0,
        salePrice: product.salePrice || 0,
        balanceValue: currentBalance > 0 ? balanceValue : 0,
      }
    })

    return NextResponse.json({ report, success: true })
  } catch (error) {
    console.error('Error fetching inventory report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory report', success: false },
      { status: 500 }
    )
  }
}
