import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mobile = searchParams.get("mobile")?.trim()

    if (!mobile) {
      return NextResponse.json({ error: "mobile is required" }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { mobileNo: mobile },
      select: { id: true, name: true, mobileNo: true },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("[CUSTOMER_BY_MOBILE_GET]", error)
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
  }
}
