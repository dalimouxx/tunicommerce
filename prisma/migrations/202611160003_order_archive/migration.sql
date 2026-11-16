BEGIN;
CREATE TABLE "CommerceOrderArchive" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "sourceKind" TEXT NOT NULL CHECK ("sourceKind" IN ('SHOP','WORKSPACE')),
 "sourceId" TEXT NOT NULL,
 "orderId" TEXT NOT NULL,
 "events" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "compactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommerceOrderArchive_sourceKind_sourceId_orderId_key" ON "CommerceOrderArchive"("sourceKind","sourceId","orderId");
COMMIT;
