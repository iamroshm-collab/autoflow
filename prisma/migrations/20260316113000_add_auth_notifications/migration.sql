CREATE TABLE "AppUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");
CREATE INDEX "AppUser_role_idx" ON "AppUser"("role");
CREATE INDEX "AppUser_approvalStatus_idx" ON "AppUser"("approvalStatus");

CREATE TABLE "AppSession" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSession_token_key" ON "AppSession"("token");
CREATE INDEX "AppSession_userId_idx" ON "AppSession"("userId");
CREATE INDEX "AppSession_expiresAt_idx" ON "AppSession"("expiresAt");

ALTER TABLE "AppSession"
ADD CONSTRAINT "AppSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AppUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AppNotification" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'info',
  "targetRole" TEXT,
  "targetUserId" TEXT,
  "targetForm" TEXT,
  "url" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppNotification_targetRole_idx" ON "AppNotification"("targetRole");
CREATE INDEX "AppNotification_targetUserId_idx" ON "AppNotification"("targetUserId");
CREATE INDEX "AppNotification_isRead_idx" ON "AppNotification"("isRead");
CREATE INDEX "AppNotification_createdAt_idx" ON "AppNotification"("createdAt");

ALTER TABLE "AppNotification"
ADD CONSTRAINT "AppNotification_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "AppUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
