ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MERCHANT';
-- Only the original installation owner becomes platform administrator.
UPDATE "User" SET "role"='ADMIN' WHERE id=(SELECT id FROM "User" ORDER BY "createdAt",id LIMIT 1) AND EXISTS(SELECT 1 FROM "SetupLock" WHERE id=1);
ALTER TABLE "Workspace" ADD COLUMN "slug" TEXT, ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'STARTER', ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL', ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE TABLE "PublicReceipt" ("id" TEXT PRIMARY KEY,"workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,"requestId" TEXT NOT NULL,"reference" TEXT NOT NULL,"total" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "PublicReceipt_workspaceId_requestId_key" ON "PublicReceipt"("workspaceId","requestId");
CREATE TABLE "PlatformAudit" ("id" TEXT PRIMARY KEY,"actorId" TEXT NOT NULL,"workspaceId" TEXT NOT NULL,"detail" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
