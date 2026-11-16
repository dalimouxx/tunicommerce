BEGIN;
CREATE TABLE "CustomerDeliveryOutcome" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "phoneKey" TEXT NOT NULL CHECK (char_length("phoneKey") = 64),
 "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "orderId" TEXT NOT NULL,
 "outcome" TEXT NOT NULL CHECK ("outcome" IN ('DELIVERED','REFUSED')),
 "occurredAt" TIMESTAMP(3) NOT NULL,
 "contestStatus" TEXT CHECK ("contestStatus" IS NULL OR "contestStatus" IN ('PENDING','ACCEPTED','REJECTED')),
 "contestReason" TEXT CHECK ("contestReason" IS NULL OR char_length("contestReason") <= 500),
 "contestedAt" TIMESTAMP(3),
 "decidedAt" TIMESTAMP(3),
 "decidedBy" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CustomerDeliveryOutcome_shopId_orderId_key" ON "CustomerDeliveryOutcome"("shopId","orderId");
CREATE INDEX "CustomerDeliveryOutcome_phoneKey_idx" ON "CustomerDeliveryOutcome"("phoneKey");
CREATE INDEX "CustomerDeliveryOutcome_contestStatus_contestedAt_idx" ON "CustomerDeliveryOutcome"("contestStatus","contestedAt");
COMMIT;
