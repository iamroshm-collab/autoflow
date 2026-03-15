import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { productId, newPrice } = body
    if (!productId || typeof newPrice !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const updated = await prisma.product.update({ where: { productId: Number(productId) }, data: { purchasePrice: Number(newPrice) } })
    return NextResponse.json({ success: true, product: updated })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update price' }, { status: 500 })
  }
}
