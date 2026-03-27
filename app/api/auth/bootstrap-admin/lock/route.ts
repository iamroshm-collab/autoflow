import { NextRequest, NextResponse } from "next/server"
import { getAdminBootstrapStatus, lockAdminBootstrap, validateAdminBootstrapKey } from "@/lib/admin-bootstrap"

export async function POST(request: NextRequest) {
  const status = getAdminBootstrapStatus()

  if (!status.enabledByEnv) {
    return NextResponse.json(
      { error: "Bootstrap is already disabled by environment." },
      { status: 400 }
    )
  }

  if (!status.hasSetupKey) {
    return NextResponse.json(
      { error: "Server is missing ADMIN_BOOTSTRAP_KEY configuration." },
      { status: 500 }
    )
  }

  const body = await request.json()
  const providedKey = String(body?.setupKey || "").trim()
  const keyValidation = validateAdminBootstrapKey(providedKey)
  if (!keyValidation.ok) {
    return NextResponse.json({ error: "Invalid setup key." }, { status: 401 })
  }

  const result = lockAdminBootstrap()
  return NextResponse.json({
    success: true,
    locked: true,
    persisted: result.persisted,
  })
}
