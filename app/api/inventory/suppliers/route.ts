import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({ select: { supplierId: true, supplierName: true }, orderBy: { supplierName: 'asc' } })
    return NextResponse.json(suppliers)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}
