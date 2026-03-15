import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const prismaClient = prisma as any

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() || ""

    const products = await prismaClient.product.findMany({
      where: search
        ? {
            OR: [
              { productName: { contains: search } },
              { hsnCode: { contains: search } },
            ],
          }
        : undefined,
      include: {
        supplier: {
          select: {
            supplierId: true,
            supplierName: true,
          },
        },
      },
      orderBy: [{ productName: "asc" }],
      take: 200,
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error("[PRODUCTS_GET]", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}
