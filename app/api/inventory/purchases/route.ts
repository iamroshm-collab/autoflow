import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { purchaseDate, supplierId, items } = body
    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const purchase = await prisma.purchase.create({
      data: {
        purchaseDate: new Date(purchaseDate),
        supplierId: Number(supplierId),
        supplier: (await prisma.supplier.findUnique({ where: { supplierId: Number(supplierId) } }))?.supplierName ?? '',
        purchaseDetails: {
          create: items.map((it: any) => ({
            productId: Number(it.productId),
            product: '',
            qnty: Number(it.qnty),
            purchasePrice: Number(it.purchasePrice),
            amount: Number(it.qnty) * Number(it.purchasePrice)
          }))
        }
      },
      include: { purchaseDetails: true }
    })

    return NextResponse.json({ success: true, purchase })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save purchase' }, { status: 500 })
  }
}
