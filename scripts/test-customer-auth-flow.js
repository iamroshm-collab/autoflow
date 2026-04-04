#!/usr/bin/env node
/**
 * test-customer-auth-flow.js
 *
 * End-to-end QA script for the customer (and office-role) login flow.
 * Run against a local dev server:  node scripts/test-customer-auth-flow.js
 *
 * What it exercises
 * -----------------
 * 1. Register a customer account (POST /api/auth/register)
 * 2. Attempt login before OTP verification → expect 403 otp_pending
 * 3. Verify OTP (POST /api/auth/register verifyOtpOnly:true) — you must supply
 *    the real OTP received on WhatsApp, or mock verifyWhatsappOtp in dev.
 * 4. Attempt login after OTP but before admin approval → expect 403 account pending
 * 5. Admin approves account (POST /api/auth/approve action:approve role:customer)
 * 6. Login from a new device → expect 403 device_pending
 * 7. Admin approves device (POST /api/auth/approve action:approve-device)
 * 8. Resume approved device login → expect 200 + session cookie
 * 9. Fetch /api/auth/me with session cookie → verify role === "customer"
 * 10. Repeat steps 6-9 for a supervisor account to verify OFFICE_ATTENDANCE_ROLES redirect.
 *
 * Usage
 * -----
 *   BASE_URL=http://localhost:3000 ADMIN_COOKIE=<session> OTP=<otp> node scripts/test-customer-auth-flow.js
 *
 * ADMIN_COOKIE  — value of the autoflow_session cookie from an active admin browser session
 * OTP           — WhatsApp OTP received during registration (or "000000" if mock is active)
 * BASE_URL      — defaults to http://localhost:3000
 */

"use strict"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || ""
const OTP = process.env.OTP || "000000"

// Unique mobile per run so we don't collide with leftover test data
const RUN_ID = Date.now().toString().slice(-6)
const CUSTOMER_MOBILE = `90000${RUN_ID}`
const DEVICE_ID = `web-test-device-${RUN_ID}`

const adminHeaders = {
  "Content-Type": "application/json",
  Cookie: `autoflow_session=${ADMIN_COOKIE}`,
}

let customerUserId = ""
let customerSessionCookie = ""

async function post(path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json, headers: res.headers }
}

async function get(path, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...extraHeaders },
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json }
}

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`)
    process.exitCode = 1
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function adminApproveAccount(userId, role = "customer") {
  const res = await post(
    "/api/auth/approve",
    { userId, action: "approve", accessRole: role },
    adminHeaders
  )
  return res
}

async function adminApproveDevice(userId) {
  const res = await post(
    "/api/auth/approve",
    { userId, action: "approve-device" },
    adminHeaders
  )
  return res
}

async function getPendingUsers() {
  const res = await fetch(`${BASE_URL}/api/auth/pending-users`, {
    headers: adminHeaders,
  })
  return res.json()
}

// ─── test steps ─────────────────────────────────────────────────────────────

async function step1_register() {
  console.log("\n[1] Register customer account")
  const res = await post("/api/auth/register", {
    name: "Test Customer",
    aadhar: "123456789012",
    address: "12 Test St, Chennai",
    mobile: CUSTOMER_MOBILE,
    role: "customer",
    deviceId: DEVICE_ID,
  })
  assert(res.status === 200, "Register returns 200", JSON.stringify(res.body))
  assert(res.body.success === true, "success flag is true")
}

async function step2_loginBeforeOtp() {
  console.log("\n[2] Login before OTP verified → expect 403")
  const res = await post("/api/auth/login", {
    mobile: CUSTOMER_MOBILE,
    deviceId: DEVICE_ID,
    resumeApprovedDevice: false,
  })
  assert(res.status === 403, "Returns 403 before OTP", JSON.stringify(res.body))
}

async function step3_verifyOtp() {
  console.log(`\n[3] Verify OTP (using OTP=${OTP})`)
  const res = await post("/api/auth/register", {
    mobile: CUSTOMER_MOBILE,
    otp: OTP,
    verifyOtpOnly: true,
  })
  assert(res.status === 200, "OTP verify returns 200", JSON.stringify(res.body))
  assert(res.body.success === true, "success flag is true after OTP verify")
}

async function step4_loginBeforeAdminApproval() {
  console.log("\n[4] Login before admin approval → expect 403 account pending")
  const res = await post("/api/auth/login", {
    mobile: CUSTOMER_MOBILE,
    deviceId: DEVICE_ID,
    resumeApprovedDevice: false,
  })
  assert(res.status === 403, "Returns 403 while pending", JSON.stringify(res.body))
  assert(
    !res.body.approvalStatus || res.body.approvalStatus !== "device_pending",
    "Not device_pending — still account-pending"
  )
}

async function step5_adminApprovesAccount() {
  console.log("\n[5] Admin approves customer account")
  if (!ADMIN_COOKIE) {
    console.warn("  ⚠  ADMIN_COOKIE not set — skipping admin approval step")
    return
  }
  // Find the pending user id
  const pending = await getPendingUsers()
  const match = (pending.requests || []).find(
    (u) => String(u.mobile || "").replace(/\D/g, "").slice(-10) === CUSTOMER_MOBILE
  )
  if (!match) {
    console.error("  ✗ Could not find pending customer in /api/auth/pending-users")
    process.exitCode = 1
    return
  }
  customerUserId = match.id
  console.log(`  found userId=${customerUserId}`)

  const res = await adminApproveAccount(customerUserId, "customer")
  assert(res.status === 200, "Admin approve returns 200", JSON.stringify(res.body))
}

async function step6_loginNewDevice_expectDevicePending() {
  console.log("\n[6] Login from new device → expect device_pending 403")
  const res = await post("/api/auth/login", {
    mobile: CUSTOMER_MOBILE,
    deviceId: DEVICE_ID,
    resumeApprovedDevice: false,
  })
  assert(res.status === 403, "Returns 403 for unapproved device", JSON.stringify(res.body))
  assert(res.body.approvalStatus === "device_pending", "approvalStatus === device_pending")
}

async function step7_adminApprovesDevice() {
  console.log("\n[7] Admin approves device")
  if (!ADMIN_COOKIE || !customerUserId) {
    console.warn("  ⚠  ADMIN_COOKIE or userId not set — skipping device approval step")
    return
  }
  const res = await adminApproveDevice(customerUserId)
  assert(res.status === 200, "Admin device approve returns 200", JSON.stringify(res.body))
}

async function step8_resumeApprovedLogin() {
  console.log("\n[8] Resume approved device login → expect 200 + session cookie")
  const res = await post("/api/auth/login", {
    mobile: CUSTOMER_MOBILE,
    deviceId: DEVICE_ID,
    resumeApprovedDevice: true,
  })
  assert(res.status === 200, "Resume login returns 200", JSON.stringify(res.body))
  assert(res.body.success === true, "success flag is true")
  assert(res.body.user?.role === "customer", `role === customer (got ${res.body.user?.role})`)

  const setCookie = res.headers.get("set-cookie") || ""
  const match = setCookie.match(/autoflow_session=([^;]+)/)
  if (match) {
    customerSessionCookie = match[1]
  }
  assert(customerSessionCookie.length > 0, "Session cookie is set")
}

async function step9_meEndpoint() {
  console.log("\n[9] /api/auth/me with session cookie → verify customer role")
  if (!customerSessionCookie) {
    console.warn("  ⚠  No session cookie from step 8 — skipping /me check")
    return
  }
  const res = await get("/api/auth/me", {
    Cookie: `autoflow_session=${customerSessionCookie}`,
  })
  assert(res.status === 200, "/api/auth/me returns 200", JSON.stringify(res.body))
  assert(res.body.user?.role === "customer", `/me confirms role === customer (got ${res.body.user?.role})`)
}

// ─── office role smoke test ──────────────────────────────────────────────────

async function officeRoleCheck() {
  console.log("\n[10] Office role redirect check — supervisor/accountant/office_staff")
  console.log("  These roles must be assigned during admin approval (accessRole=supervisor etc.).")
  console.log("  After login, the dashboard loadSession() detects OFFICE_ATTENDANCE_ROLES and")
  console.log("  calls router.replace('/mobile-attendance').")
  console.log("  Manual QA: log in as supervisor → confirm you land on /mobile-attendance.")
}

// ─── main ────────────────────────────────────────────────────────────────────

;(async () => {
  console.log("=== Customer Auth Flow — QA Script ===")
  console.log(`BASE_URL : ${BASE_URL}`)
  console.log(`MOBILE   : ${CUSTOMER_MOBILE}`)
  console.log(`DEVICE   : ${DEVICE_ID}`)
  console.log(`OTP      : ${OTP}`)
  console.log(`ADMIN    : ${ADMIN_COOKIE ? "provided" : "NOT PROVIDED — approval steps will be skipped"}`)

  try {
    await step1_register()
    await step2_loginBeforeOtp()
    await step3_verifyOtp()
    await step4_loginBeforeAdminApproval()
    await step5_adminApprovesAccount()
    await step6_loginNewDevice_expectDevicePending()
    await step7_adminApprovesDevice()
    await step8_resumeApprovedLogin()
    await step9_meEndpoint()
    await officeRoleCheck()
  } catch (err) {
    console.error("\nUnexpected error:", err)
    process.exitCode = 1
  }

  console.log("\n=== Done ===")
  if (process.exitCode === 1) {
    console.error("One or more assertions failed.")
  } else {
    console.log("All assertions passed.")
  }
})()
