BEGIN;
CREATE TABLE "CommerceJournalEntry" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "sourceKind" TEXT NOT NULL CHECK ("sourceKind" IN ('SHOP','WORKSPACE')),
 "sourceId" TEXT NOT NULL,
 "entryId" TEXT NOT NULL,
 "at" TIMESTAMP(3) NOT NULL,
 "label" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommerceJournalEntry_sourceKind_sourceId_entryId_key" ON "CommerceJournalEntry"("sourceKind","sourceId","entryId");
CREATE INDEX "CommerceJournalEntry_sourceKind_sourceId_at_idx" ON "CommerceJournalEntry"("sourceKind","sourceId","at" DESC);
CREATE TABLE "CommerceStockMovement" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "sourceKind" TEXT NOT NULL CHECK ("sourceKind" IN ('SHOP','WORKSPACE')),
 "sourceId" TEXT NOT NULL,
 "entryId" TEXT NOT NULL,
 "productId" TEXT NOT NULL,
 "label" TEXT NOT NULL,
 "quantity" INTEGER NOT NULL,
 "at" TIMESTAMP(3) NOT NULL,
 "orderId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommerceStockMovement_sourceKind_sourceId_entryId_key" ON "CommerceStockMovement"("sourceKind","sourceId","entryId");
CREATE INDEX "CommerceStockMovement_sourceKind_sourceId_at_idx" ON "CommerceStockMovement"("sourceKind","sourceId","at" DESC);
COMMIT;
