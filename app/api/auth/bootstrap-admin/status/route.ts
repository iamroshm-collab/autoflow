import { NextResponse } from "next/server"
import { getAdminBootstrapStatus } from "@/lib/admin-bootstrap"

export async function GET() {
  const status = getAdminBootstrapStatus()

  return NextResponse.json({
    adminBootstrap: {
      enabledByEnv: status.enabledByEnv,
      productionBlocked: status.productionBlocked,
      locked: status.locked,
      lockedByRuntime: status.lockedByRuntime,
      lockedByFile: status.lockedByFile,
      hasSetupKey: status.hasSetupKey,
      effectiveEnabled: status.effectiveEnabled,
    },
  })
}
