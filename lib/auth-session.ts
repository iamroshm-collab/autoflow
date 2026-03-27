import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { compare, hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const SESSION_COOKIE_NAME = "autoflow_session"

const prismaClient = prisma as any

export const hashPassword = async (password: string) => {
  return hash(password, 12)
}

export const verifyPassword = async (password: string, stored: string) => {
  if (!String(stored || "").trim()) {
    return false
  }
  return compare(password, stored)
}

export const createSessionForUser = async (userId: string) => {
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)

  await prismaClient.appSession.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  })

  return { token, expiresAt }
}

export const setSessionCookie = (response: NextResponse, token: string, expiresAt: Date) => {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
}

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })
}

export const getCurrentUserFromRequest = async (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    return null
  }

  const session = await prismaClient.appSession.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || !session.user) {
    return null
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await prismaClient.appSession.deleteMany({ where: { token } })
    return null
  }

  return session.user
}

export const deleteSessionFromRequest = async (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    return
  }

  await prismaClient.appSession.deleteMany({ where: { token } })
}
