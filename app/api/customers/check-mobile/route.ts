import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mobileNo = searchParams.get("mobileNo")?.trim()

    if (!mobileNo) {
      return NextResponse.json({ exists: false })
    }

    const customer = await prisma.customer.findUnique({
      where: { mobileNo },
      select: { id: true, name: true },
    })

    if (!customer) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      customerId: customer.id,
      customerName: customer.name,
    })
  } catch (error) {
    console.error("[CHECK_MOBILE_GET]", error)
    return NextResponse.json({ exists: false })
  }
}
