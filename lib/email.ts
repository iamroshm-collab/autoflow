import { Resend } from "resend"

type SendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
}

let resendClient: Resend | null = null

const getResendClient = () => {
  if (resendClient) {
    return resendClient
  }

  const apiKey = String(process.env.RESEND_API_KEY || "").trim()
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured")
  }

  resendClient = new Resend(apiKey)
  return resendClient
}

const getSenderEmail = () => {
  const sender = String(process.env.EMAIL_FROM || "").trim()
  if (!sender) {
    throw new Error("EMAIL_FROM is not configured")
  }

  return sender
}

export const sendEmail = async (input: SendEmailInput) => {
  const resend = getResendClient()

  await resend.emails.send({
    from: getSenderEmail(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })
}