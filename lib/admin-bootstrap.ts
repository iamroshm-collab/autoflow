import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"

const LOCK_DIR = path.join(process.cwd(), ".runtime")
const LOCK_FILE = path.join(LOCK_DIR, "admin-bootstrap.lock")

declare global {
  var __adminBootstrapLocked: boolean | undefined
}

const getRuntimeLock = () => {
  return globalThis.__adminBootstrapLocked === true
}

const setRuntimeLock = (value: boolean) => {
  globalThis.__adminBootstrapLocked = value
}

const hasFileLock = () => {
  try {
    if (!existsSync(LOCK_FILE)) {
      return false
    }
    const content = readFileSync(LOCK_FILE, "utf8").trim().toLowerCase()
    return content === "locked"
  } catch {
    return false
  }
}

export const lockAdminBootstrap = () => {
  setRuntimeLock(true)
  try {
    if (!existsSync(LOCK_DIR)) {
      mkdirSync(LOCK_DIR, { recursive: true })
    }
    writeFileSync(LOCK_FILE, "locked", "utf8")
    return { persisted: true }
  } catch {
    return { persisted: false }
  }
}

export const getAdminBootstrapStatus = () => {
  const enabledByEnv = String(process.env.ADMIN_BOOTSTRAP_ENABLED || "false").toLowerCase() === "true"
  const allowInProduction =
    String(process.env.ADMIN_BOOTSTRAP_ALLOW_IN_PRODUCTION || "false").toLowerCase() === "true"
  const setupKey = String(process.env.ADMIN_BOOTSTRAP_KEY || "")
  const hasSetupKey = Boolean(setupKey)

  const productionBlocked = process.env.NODE_ENV === "production" && !allowInProduction
  const lockedByRuntime = getRuntimeLock()
  const lockedByFile = hasFileLock()
  const locked = lockedByRuntime || lockedByFile

  const effectiveEnabled = enabledByEnv && !productionBlocked && !locked

  return {
    enabledByEnv,
    allowInProduction,
    hasSetupKey,
    productionBlocked,
    lockedByRuntime,
    lockedByFile,
    locked,
    effectiveEnabled,
    setupKey,
  }
}

export const validateAdminBootstrapKey = (providedKey: string) => {
  const status = getAdminBootstrapStatus()
  if (!status.hasSetupKey) {
    return { ok: false, reason: "missing-key" as const }
  }

  if (String(providedKey || "").trim() !== status.setupKey) {
    return { ok: false, reason: "invalid-key" as const }
  }

  return { ok: true as const }
}
