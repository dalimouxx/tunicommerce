ALTER TABLE "Workspace" ADD COLUMN "subscriptionMailEnabled" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "subscriptionMailVersion" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Workspace_subscriptionMailEnabled_subscriptionEndsAt_id_idx"
 ON "Workspace"("subscriptionMailEnabled", "subscriptionEndsAt", "id");
