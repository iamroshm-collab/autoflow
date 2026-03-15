import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const states = await prisma.state.findMany({
      orderBy: { stateName: 'asc' }
    })
    return NextResponse.json(states)
  } catch (error) {
    console.error("[STATES_GET]", error)
    return NextResponse.json({ error: "Failed to fetch states" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stateName, stateCode } = body

    if (!stateName?.trim()) {
      return NextResponse.json({ error: "State name is required" }, { status: 400 })
    }

    const state = await prisma.state.create({
      data: {
        stateName: stateName.trim(),
        stateCode: stateCode?.trim() || null,
      },
    })

    return NextResponse.json(state)
  } catch (error) {
    console.error("[STATES_POST]", error)
    return NextResponse.json({ error: "Failed to create state" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { stateId, stateName, stateCode } = body

    if (!stateId) {
      return NextResponse.json({ error: "State Code is required" }, { status: 400 })
    }

    if (!stateName?.trim()) {
      return NextResponse.json({ error: "State name is required" }, { status: 400 })
    }

    const state = await prisma.state.update({
      where: { stateId },
      data: {
        stateName: stateName.trim(),
        stateCode: stateCode?.trim() || null,
      },
    })

    return NextResponse.json(state)
  } catch (error) {
    console.error("[STATES_PUT]", error)
    return NextResponse.json({ error: "Failed to update state" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stateId = searchParams.get("stateId")

    if (!stateId) {
      return NextResponse.json({ error: "State Code is required" }, { status: 400 })
    }

    await prisma.state.delete({
      where: { stateId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[STATES_DELETE]", error)
    return NextResponse.json({ error: "Failed to delete state" }, { status: 500 })
  }
}
