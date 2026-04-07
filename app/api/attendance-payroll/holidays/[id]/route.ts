import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUserFromRequest } from "@/lib/auth-session"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const id = Number(params.id)
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

    const body = await request.json()
    const date = String(body.date || "").trim()
    const name = String(body.name || "").trim()
    const description = String(body.description || "").trim()

    const updated = await prisma.holiday.update({ where: { id }, data: { date, name, description } })
    return NextResponse.json(updated)
  } catch (err) {
    console.error("PUT /holidays/[id] error", err)
    return NextResponse.json({ error: "Failed to update holiday" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request)
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const id = Number(params.id)
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

    await prisma.holiday.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /holidays/[id] error", err)
    return NextResponse.json({ error: "Failed to delete holiday" }, { status: 500 })
  }
}
