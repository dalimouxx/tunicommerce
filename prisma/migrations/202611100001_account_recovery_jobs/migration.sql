ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "mfaSecret" TEXT, ADD COLUMN "mfaEnabledAt" TIMESTAMP(3),
 ADD COLUMN "mfaLastStep" INTEGER, ADD COLUMN "mfaPendingSecret" TEXT,
 ADD COLUMN "mfaPendingExpiresAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "MfaRecoveryCode" (
 "codeHash" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "usedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MfaRecoveryCode_userId_idx" ON "MfaRecoveryCode"("userId");
CREATE TABLE "AccountActionToken" (
 "tokenHash" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "purpose" TEXT NOT NULL, "email" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AccountActionToken_userId_purpose_key" ON "AccountActionToken"("userId","purpose");
CREATE INDEX "AccountActionToken_expiresAt_idx" ON "AccountActionToken"("expiresAt");
CREATE TABLE "AccountSecurityEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "kind" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AccountSecurityEvent_userId_createdAt_idx" ON "AccountSecurityEvent"("userId","createdAt");
CREATE TABLE "BackgroundJob" (
 "id" TEXT NOT NULL PRIMARY KEY,"kind" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',
 "subjectKey" TEXT NOT NULL,"dedupKey" TEXT NOT NULL,"payload" TEXT,
 "attempts" INTEGER NOT NULL DEFAULT 0,"maxAttempts" INTEGER NOT NULL DEFAULT 4,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseId" TEXT,"lockedUntil" TIMESTAMP(3),"errorCode" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"finishedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "BackgroundJob_dedupKey_key" ON "BackgroundJob"("dedupKey");
CREATE INDEX "BackgroundJob_status_availableAt_idx" ON "BackgroundJob"("status","availableAt");
CREATE INDEX "BackgroundJob_subjectKey_status_idx" ON "BackgroundJob"("subjectKey","status");
