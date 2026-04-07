import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

export async function GET() {
  try {
    const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } })
    return NextResponse.json(holidays)
  } catch (err) {
    console.error("GET /holidays error", err)
    return NextResponse.json({ error: "Failed to fetch holidays" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const date = String(body.date || "").trim()
    const name = String(body.name || "").trim()
    const description = String(body.description || "").trim()

    if (!date || !name) {
      return NextResponse.json({ error: "date and name are required" }, { status: 400 })
    }

    // Check duplicate
    const exists = await prisma.holiday.findUnique({ where: { date } })
    if (exists) {
      return NextResponse.json({ error: "Holiday for this date already exists" }, { status: 409 })
    }

    const created = await prisma.holiday.create({ data: { date, name, description } })
    return NextResponse.json(created)
  } catch (err) {
    console.error("POST /holidays error", err)
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 })
  }
}
