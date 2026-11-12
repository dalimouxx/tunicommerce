CREATE TABLE "ShopWebhook" (
 "shopId" TEXT NOT NULL PRIMARY KEY,
 "ownerId" TEXT NOT NULL,
 "endpointEnvelope" TEXT,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "secretEnvelope" TEXT,
 "version" INTEGER NOT NULL DEFAULT 0,
 "budgetDay" TEXT NOT NULL DEFAULT '',
 "budgetCount" INTEGER NOT NULL DEFAULT 0,
 "droppedCount" INTEGER NOT NULL DEFAULT 0,
 "lastDropAt" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ShopWebhook_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ShopWebhookEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "shopId" TEXT NOT NULL,
 "ownerId" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "body" TEXT,
 "lastJobId" TEXT,
 "deliveryCount" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ShopWebhookEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ShopWebhookEvent_shopId_createdAt_idx" ON "ShopWebhookEvent"("shopId","createdAt");
CREATE INDEX "ShopWebhookEvent_createdAt_idx" ON "ShopWebhookEvent"("createdAt");
