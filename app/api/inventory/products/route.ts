import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const supplierId = url.searchParams.get('supplierId')
    const where: any = {}
    if (supplierId) where.supplierId = Number(supplierId)
    const products = await prisma.product.findMany({ where, select: { productId: true, productName: true, purchasePrice: true }, orderBy: { productName: 'asc' } })
    return NextResponse.json(products)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
