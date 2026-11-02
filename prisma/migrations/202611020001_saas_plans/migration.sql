-- SaaS plan catalog. Additive; no change to historical workspaces, orders or existing assignments.
CREATE TABLE "SubscriptionPlan" (
 "code" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "description" TEXT NOT NULL DEFAULT '',
 "priceMillimes" INTEGER NOT NULL DEFAULT 0,
 "durationDays" INTEGER NOT NULL DEFAULT 30,
 "maxProducts" INTEGER,
 "maxOrdersPerMonth" INTEGER,
 "maxPhotos" INTEGER,
 "maxShops" INTEGER,
 "maxMembers" INTEGER,
 "modules" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("code"),
 CONSTRAINT "SubscriptionPlan_valid_limits" CHECK (
  "priceMillimes">=0 AND "durationDays" BETWEEN 1 AND 3650
  AND ("maxProducts" IS NULL OR "maxProducts">=0)
  AND ("maxOrdersPerMonth" IS NULL OR "maxOrdersPerMonth">=0)
  AND ("maxPhotos" IS NULL OR "maxPhotos">=0)
  AND ("maxShops" IS NULL OR "maxShops">=0)
  AND ("maxMembers" IS NULL OR "maxMembers">=0)
 )
);
CREATE TABLE "WorkspacePlanOverride" (
 "workspaceId" TEXT NOT NULL,
 "maxProducts" INTEGER,
 "maxOrdersPerMonth" INTEGER,
 "maxPhotos" INTEGER,
 "note" TEXT NOT NULL DEFAULT '',
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WorkspacePlanOverride_pkey" PRIMARY KEY ("workspaceId"),
 CONSTRAINT "WorkspacePlanOverride_nonnegative" CHECK (
  ("maxProducts" IS NULL OR "maxProducts">=0)
  AND ("maxOrdersPerMonth" IS NULL OR "maxOrdersPerMonth">=0)
  AND ("maxPhotos" IS NULL OR "maxPhotos">=0)
 )
);
ALTER TABLE "WorkspacePlanOverride" ADD CONSTRAINT "WorkspacePlanOverride_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Commercial prices and limits are *not* invented. Defaults leave existing shops unrestricted;
-- the original physical 30-photo safety cap still applies.
INSERT INTO "SubscriptionPlan" (
 "code","name","description","priceMillimes","durationDays","modules","enabled","updatedAt"
) VALUES
 ('FREE','Gratuit','Offre gratuite à configurer',0,30,'{}'::jsonb,true,NOW()),
 ('STARTER','Starter','Première boutique à configurer',0,30,'{}'::jsonb,true,NOW()),
 ('PRO','Pro','Commerce en croissance à configurer',0,30,'{}'::jsonb,true,NOW()),
 ('BUSINESS','Business','Équipes et opérations à configurer',0,30,'{}'::jsonb,true,NOW()),
 ('AGENCY','Agency','Gestion multi-boutique à configurer',0,30,'{}'::jsonb,true,NOW())
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "SubscriptionPlanAudit" (
 "id" TEXT NOT NULL,
 "actorId" TEXT NOT NULL,
 "planCode" TEXT NOT NULL,
 "details" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SubscriptionPlanAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionPlanAudit_planCode_createdAt_idx" ON "SubscriptionPlanAudit"("planCode","createdAt");
