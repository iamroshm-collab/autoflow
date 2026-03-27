const baseUrl = process.env.AUTH_SMOKE_BASE_URL || "http://localhost:3000"

function randomDigits(length) {
  let value = ""
  while (value.length < length) {
    value += Math.floor(Math.random() * 10)
  }
  return value.slice(0, length)
}

function buildRegistrationSeed() {
  const managerMobile = `9${randomDigits(9)}`
  const technicianMobile = `8${randomDigits(9)}`
  const adminMobile = `7${randomDigits(9)}`

  return {
    adminMobile,
    managerMobile,
    technicianMobile,
    adminAadhar: `3${randomDigits(11)}`,
    managerAadhar: `1${randomDigits(11)}`,
    technicianAadhar: `2${randomDigits(11)}`,
  }
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  return {
    status: response.status,
    ok: response.ok,
    body: payload,
  }
}

async function run() {
  const jsonMode = process.argv.includes("--json")
  const seed = buildRegistrationSeed()

  const admin = await postJson("/api/auth/register", {
    name: "Blocked Admin",
    mobile: seed.adminMobile,
    aadhar: seed.adminAadhar,
    address: "Blocked admin address",
    role: "admin",
  })

  const manager = await postJson("/api/auth/register", {
    name: "Manager OK",
    role: "manager",
    mobile: seed.managerMobile,
    aadhar: seed.managerAadhar,
    address: "Flat 2A, Main Street, Chennai",
  })

  const technician = await postJson("/api/auth/register", {
    name: "Tech OK",
    role: "technician",
    mobile: seed.technicianMobile,
    aadhar: seed.technicianAadhar,
    address: "Bay 4, Workshop Lane, Chennai",
  })

  const result = {
    admin,
    manager,
    technician,
    managerMobile: seed.managerMobile,
    technicianMobile: seed.technicianMobile,
  }

  const passed =
    admin.status === 403 &&
    manager.status === 200 &&
    manager.body?.approvalStatus === "otp_pending" &&
    technician.status === 200 &&
    technician.body?.approvalStatus === "otp_pending"

  if (jsonMode) {
    console.log(JSON.stringify({ passed, ...result }))
  } else {
    const adminSummary = admin.status === 403 ? "ADMIN_BLOCKED" : `ADMIN_${admin.status}`
    const managerSummary = manager.body?.approvalStatus || `HTTP_${manager.status}`
    const technicianSummary = technician.body?.approvalStatus || `HTTP_${technician.status}`
    console.log([
      passed ? "PASS" : "FAIL",
      adminSummary,
      managerSummary,
      technicianSummary,
      seed.managerMobile,
      seed.technicianMobile,
    ].join("|"))
  }

  if (!passed) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})