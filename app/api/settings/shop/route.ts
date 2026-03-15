import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Get the first (and should be only) shop settings record
    const settings = await prisma.shopSettings.findFirst({
      orderBy: { createdAt: 'asc' }
    })

    if (!settings) {
      // Return default empty settings if none exist
      return NextResponse.json({
        id: null,
        shopName: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        phone1: "",
        phone2: "",
        upiId: "",
        email: "",
        gstin: "",
        pan: "",
        stateId: "",
        website: "",
        logo: "",
        garageLatitude: "",
        garageLongitude: "",
        attendanceRadiusMeters: 20,
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("[SETTINGS_SHOP_GET]", error)
    return NextResponse.json({ error: "Failed to fetch shop settings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      shopName,
      address,
      city,
      state,
      pincode,
      phone1,
      phone2,
      upiId,
      email,
      gstin,
      pan,
      stateId,
      website,
      logo,
      garageLatitude,
      garageLongitude,
      attendanceRadiusMeters,
    } = body

    if (!shopName) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 })
    }

    // Check if settings already exist
    const existing = await prisma.shopSettings.findFirst()

    let settings
    if (existing) {
      // Update existing settings
      settings = await prisma.shopSettings.update({
        where: { id: existing.id },
        data: {
          shopName,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          phone1: phone1 || null,
          phone2: phone2 || null,
          upiId: upiId || null,
          email: email || null,
          gstin: gstin || null,
          pan: pan || null,
          stateId: stateId || null,
          website: website || null,
          logo: logo || null,
          garageLatitude: garageLatitude === "" || garageLatitude === null || garageLatitude === undefined ? null : Number(garageLatitude),
          garageLongitude: garageLongitude === "" || garageLongitude === null || garageLongitude === undefined ? null : Number(garageLongitude),
          attendanceRadiusMeters: Number(attendanceRadiusMeters || 20),
        },
      })
    } else {
      // Create new settings
      settings = await prisma.shopSettings.create({
        data: {
          shopName,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          phone1: phone1 || null,
          phone2: phone2 || null,
          upiId: upiId || null,
          email: email || null,
          gstin: gstin || null,
          pan: pan || null,
          stateId: stateId || null,
          website: website || null,
          logo: logo || null,
          garageLatitude: garageLatitude === "" || garageLatitude === null || garageLatitude === undefined ? null : Number(garageLatitude),
          garageLongitude: garageLongitude === "" || garageLongitude === null || garageLongitude === undefined ? null : Number(garageLongitude),
          attendanceRadiusMeters: Number(attendanceRadiusMeters || 20),
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("[SETTINGS_SHOP_POST]", error)
    return NextResponse.json({ error: "Failed to save shop settings" }, { status: 500 })
  }
}
