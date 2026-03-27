import { NextRequest } from "next/server"

export const getClientIpAddress = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstHop = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean)

    if (firstHop) {
      return firstHop
    }
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp.trim()
  }

  const cloudflareIp = request.headers.get("cf-connecting-ip")
  if (cloudflareIp) {
    return cloudflareIp.trim()
  }

  return null
}
