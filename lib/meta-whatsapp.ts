/**
 * Meta Cloud API — WhatsApp messaging service
 * Handles OTP sending and job card customer notifications via approved templates.
 */

const META_API_BASE = "https://graph.facebook.com"

function getMetaConfig() {
  return {
    accessToken: String(process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim(),
    phoneNumberId: String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || "").trim(),
    apiVersion: String(process.env.META_WHATSAPP_API_VERSION || "v20.0").trim(),
  }
}

/** Normalise Indian mobile numbers to E.164 format (91XXXXXXXXXX) */
function formatIndianMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "")
  if (digits.startsWith("91") && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  return digits
}

/**
 * Send a WhatsApp template message via Meta Cloud API.
 * `bodyParams` maps 1-to-1 to {{1}}, {{2}}, ... placeholders in the template body.
 */
export async function sendMetaWhatsappTemplate(params: {
  to: string
  templateName: string
  languageCode?: string
  bodyParams?: string[]
  buttonUrlParam?: string
}) {
  const { accessToken, phoneNumberId, apiVersion } = getMetaConfig()

  if (!accessToken || !phoneNumberId) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Meta WhatsApp configuration is incomplete (ACCESS_TOKEN or PHONE_NUMBER_ID missing)")
    }
    console.info(`[META_WHATSAPP_DEV] Would send template "${params.templateName}" to ${params.to}`, params.bodyParams)
    return
  }

  const to = formatIndianMobile(params.to)

  const components: Array<Record<string, unknown>> = []

  if (params.bodyParams && params.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: params.bodyParams.map((text) => ({ type: "text", text })),
    })
  }

  if (params.buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: params.buttonUrlParam }],
    })
  }

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode || "en" },
      ...(components.length > 0 ? { components } : {}),
    },
  }

  const url = `${META_API_BASE}/${apiVersion}/${phoneNumberId}/messages`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Meta WhatsApp API failed: ${response.status} ${errorText}`)
  }

  return response.json()
}

/**
 * Send a plain text WhatsApp message via Meta Cloud API.
 */
export async function sendMetaWhatsappText(params: {
  to: string
  message: string
}) {
  const { accessToken, phoneNumberId, apiVersion } = getMetaConfig()

  if (!accessToken || !phoneNumberId || !apiVersion) {
    throw new Error("Meta WhatsApp configuration is incomplete")
  }

  const to = formatIndianMobile(params.to)
  const messageBody = String(params.message || "").trim()

  if (!to || !messageBody) {
    throw new Error("Recipient phone number and message are required")
  }

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body: messageBody,
    },
  }

  const url = `${META_API_BASE}/${apiVersion}/${phoneNumberId}/messages`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Meta WhatsApp API failed: ${response.status} ${errorText}`)
  }

  return response.json()
}

/**
 * Send OTP to a customer via Meta Cloud API.
 * Requires META_WHATSAPP_OTP_TEMPLATE_NAME — a template with a single {{1}} body parameter.
 *
 * Example template body: "Your AutoFlow OTP is *{{1}}*. Valid for 5 minutes. Do not share."
 */
export async function sendMetaWhatsappOtp(mobile: string, otp: string) {
  const templateName = String(process.env.META_WHATSAPP_OTP_TEMPLATE_NAME || "").trim()

  if (!templateName) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("META_WHATSAPP_OTP_TEMPLATE_NAME is not configured")
    }
    console.info(`[META_WHATSAPP_OTP_DEV] mobile=${mobile} otp=${otp}`)
    return
  }

  try {
    return await sendMetaWhatsappTemplate({
      to: mobile,
      templateName,
      languageCode: "en_US",
      bodyParams: [otp],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const needsButtonParam = message.includes("Button at index 0 of type Url requires a parameter")

    if (!needsButtonParam) {
      throw error
    }

    // Some OTP templates require an URL button placeholder parameter in addition to body {{1}}.
    return sendMetaWhatsappTemplate({
      to: mobile,
      templateName,
      languageCode: "en_US",
      bodyParams: [otp],
      buttonUrlParam: otp,
    })
  }
}

/**
 * Notify an approved user that their login has been approved.
 * Reads META_WHATSAPP_LOGIN_APPROVED_TEMPLATE_NAME, falls back to "login_approved".
 * Template body: "Hello {{1}},\nYour login to the AutoFlow Garage Management System has been approved."
 *   {{1}} = user name
 */
export async function sendMetaWhatsappLoginApproved(mobile: string, name: string) {
  const templateName =
    String(process.env.META_WHATSAPP_LOGIN_APPROVED_TEMPLATE_NAME || "").trim() || "login_approved"

  return sendMetaWhatsappTemplate({
    to: mobile,
    templateName,
    languageCode: "en_US",
    bodyParams: [name],
  })
}

/**
 * Notify a technician when a new job card is assigned to them.
 * Template: META_WHATSAPP_NEW_JOBCARD_ASSIGNED (e.g. "jobcard_update")
 * Body: Vehicle: *{{1}} {{2}}* / Reg No: *{{3}}* / Job Type: *{{4}}* / Assigned to: *{{5}}* / Status: *Pending*
 *   {{1}} = vehicle make, {{2}} = vehicle model, {{3}} = reg number, {{4}} = job type, {{5}} = technician name
 */
export async function sendMetaWhatsappJobCardAssigned(params: {
  mobile: string
  vehicleMake: string
  vehicleModel: string
  regNumber: string
  jobType: string
  technicianName: string
}) {
  const templateName = String(process.env.META_WHATSAPP_NEW_JOBCARD_ASSIGNED || "").trim()

  if (!templateName) {
    console.info("[META_WHATSAPP_JC_ASSIGNED] Skipped — META_WHATSAPP_NEW_JOBCARD_ASSIGNED not set")
    return
  }

  try {
    return await sendMetaWhatsappTemplate({
      to: params.mobile,
      templateName,
      languageCode: "en_US",
      bodyParams: [params.vehicleMake, params.vehicleModel, params.regNumber, params.jobType, params.technicianName],
    })
  } catch (err) {
    console.error("[META_WHATSAPP_JC_ASSIGNED] Failed to send notification", err)
  }
}

/**
 * Notify a customer when a new job card is created for their vehicle.
 * Template: META_WHATSAPP_JOBCARD_GENERATED (e.g. "jobcard_created")
 * Body: Hi {{1}}, Vehicle: *{{2}} {{3}}* / Reg No: *{{4}}* / Jobcard Number: *{{5}}* / Date/Time: *{{6}}*
 *   {{1}} = customer name, {{2}} = vehicle make, {{3}} = vehicle model,
 *   {{4}} = reg number, {{5}} = jobcard number, {{6}} = date/time
 */
export async function sendMetaWhatsappJobCardCreated(params: {
  mobile: string
  customerName: string
  vehicleMake: string
  vehicleModel: string
  regNumber: string
  jobCardNumber: string
  dateTime: string
}) {
  const templateName = String(process.env.META_WHATSAPP_JOBCARD_GENERATED || "").trim()

  if (!templateName) {
    console.info("[META_WHATSAPP_JC_CREATED] Skipped — META_WHATSAPP_JOBCARD_GENERATED not set")
    return
  }

  try {
    return await sendMetaWhatsappTemplate({
      to: params.mobile,
      templateName,
      languageCode: "en_US",
      bodyParams: [
        params.customerName,
        params.vehicleMake,
        params.vehicleModel,
        params.regNumber,
        params.jobCardNumber,
        params.dateTime,
      ],
    })
  } catch (err) {
    console.error("[META_WHATSAPP_JC_CREATED] Failed to send notification", err)
  }
}

/**
 * Notify a customer that their vehicle is ready for delivery.
 * Template: META_WHATSAPP_JOBCARD_COMPLETED (e.g. "ready_for_delivery")
 * Body: Hi *{{1}}*, Vehicle: *{{2}} {{3}}* / Reg No: *{{4}}* / Total Amount: *₹{{5}}* / Status: *Ready for delivery*
 *   {{1}} = customer name, {{2}} = vehicle make, {{3}} = vehicle model,
 *   {{4}} = reg number, {{5}} = total amount
 */
export async function sendMetaWhatsappReadyForDelivery(params: {
  mobile: string
  customerName: string
  vehicleMake: string
  vehicleModel: string
  regNumber: string
  totalAmount: string
}) {
  const templateName = String(process.env.META_WHATSAPP_JOBCARD_COMPLETED || "").trim()

  if (!templateName) {
    console.info("[META_WHATSAPP_READY] Skipped — META_WHATSAPP_JOBCARD_COMPLETED not set")
    return
  }

  try {
    return await sendMetaWhatsappTemplate({
      to: params.mobile,
      templateName,
      languageCode: "en_US",
      bodyParams: [
        params.customerName,
        params.vehicleMake,
        params.vehicleModel,
        params.regNumber,
        params.totalAmount,
      ],
    })
  } catch (err) {
    console.error("[META_WHATSAPP_READY] Failed to send notification", err)
  }
}

/**
 * Send a service review request to a customer after vehicle is delivered.
 * Template: META_WHATSAPP_SERVICE_REVIEW (e.g. "review")
 * Body: Hello {{1}}, Thanks for trusting us with the service of your *{{2}} {{3}} (Reg: {{4}})!*...
 *   {{1}} = customer name, {{2}} = vehicle make, {{3}} = vehicle model, {{4}} = reg number
 */
export async function sendMetaWhatsappServiceReview(params: {
  mobile: string
  customerName: string
  vehicleMake: string
  vehicleModel: string
  regNumber: string
}) {
  const templateName = String(process.env.META_WHATSAPP_SERVICE_REVIEW || "").trim()

  if (!templateName) {
    console.info("[META_WHATSAPP_REVIEW] Skipped — META_WHATSAPP_SERVICE_REVIEW not set")
    return
  }

  try {
    return await sendMetaWhatsappTemplate({
      to: params.mobile,
      templateName,
      languageCode: "en_US",
      bodyParams: [params.customerName, params.vehicleMake, params.vehicleModel, params.regNumber],
    })
  } catch (err) {
    console.error("[META_WHATSAPP_REVIEW] Failed to send notification", err)
  }
}
