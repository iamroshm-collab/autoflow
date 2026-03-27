const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") })

const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const baseUrl = process.env.AUTH_SMOKE_BASE_URL || "http://localhost:3000"

function randomDigits(length) {
  let value = ""
  while (value.length < length) {
    value += Math.floor(Math.random() * 10)
  }
  return value.slice(0, length)
}

function buildSeed() {
  return {
    mobile: `9${randomDigits(9)}`,
    aadhar: `3${randomDigits(11)}`,
    approvedDeviceId: `smoke-approved-${Date.now()}`,
    newDeviceId: `smoke-new-${Date.now()}`,
  }
}

async function postJson(routePath, body) {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  return {
    status: response.status,
    ok: response.ok,
    body: payload,
  }
}

async function run() {
  const jsonMode = process.argv.includes("--json")
  const seed = buildSeed()
  let createdUserId = null

  try {
    const register = await postJson("/api/auth/register", {
      name: "E2E Smoke User",
      mobile: seed.mobile,
      aadhar: seed.aadhar,
      address: "E2E street, test city",
      role: "technician",
      deviceId: seed.approvedDeviceId,
    })

    const createdUser = await prisma.appUser.findFirst({
      where: { mobile: seed.mobile },
      select: { id: true, approvalStatus: true },
    })

    if (!createdUser) {
      throw new Error("User was not created by register flow")
    }

    createdUserId = createdUser.id

    // Simulate OTP success transition (otp_pending -> pending) for automated smoke.
    await prisma.appUser.update({
      where: { id: createdUser.id },
      data: { approvalStatus: "pending" },
    })

    // Simulate admin approval outcome and approved device mapping.
    await prisma.appUser.update({
      where: { id: createdUser.id },
      data: {
        approvalStatus: "approved",
        role: "technician",
        approvedAt: new Date(),
        requestedDeviceId: seed.approvedDeviceId,
        requestedDeviceIp: "127.0.0.1",
        approvedDeviceId: seed.approvedDeviceId,
        approvedDeviceIp: "127.0.0.1",
        pendingDeviceId: null,
        pendingDeviceIp: null,
        deviceApprovalStatus: "none",
      },
    })

    const loginApprovedDevice = await postJson("/api/auth/login", {
      mobile: seed.mobile,
      deviceId: seed.approvedDeviceId,
      resumeApprovedDevice: true,
    })

    const loginNewDevice = await postJson("/api/auth/login", {
      mobile: seed.mobile,
      deviceId: seed.newDeviceId,
      resumeApprovedDevice: true,
    })

    const dbAfterNewDevice = await prisma.appUser.findUnique({
      where: { id: createdUser.id },
      select: {
        pendingDeviceId: true,
        deviceApprovalStatus: true,
      },
    })

    const passed =
      register.status === 200 &&
      register.body?.approvalStatus === "otp_pending" &&
      loginApprovedDevice.status === 200 &&
      loginApprovedDevice.body?.success === true &&
      loginApprovedDevice.body?.resumed === true &&
      loginNewDevice.status === 403 &&
      loginNewDevice.body?.approvalStatus === "device_pending" &&
      dbAfterNewDevice?.pendingDeviceId === seed.newDeviceId &&
      String(dbAfterNewDevice?.deviceApprovalStatus || "").toLowerCase() === "pending"

    const result = {
      passed,
      mobile: seed.mobile,
      register,
      loginApprovedDevice,
      loginNewDevice,
      dbAfterNewDevice,
    }

    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      const summary = [
        passed ? "PASS" : "FAIL",
        `REGISTER_${register.status}_${register.body?.approvalStatus || "unknown"}`,
        `APPROVED_DEVICE_${loginApprovedDevice.status}`,
        `NEW_DEVICE_${loginNewDevice.status}_${loginNewDevice.body?.approvalStatus || "unknown"}`,
        seed.mobile,
      ]
      console.log(summary.join("|"))
    }

    if (!passed) {
      process.exitCode = 1
    }
  } finally {
    if (createdUserId) {
      await prisma.appUser.deleteMany({ where: { id: createdUserId } }).catch(() => {})
    }
    await prisma.$disconnect()
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
