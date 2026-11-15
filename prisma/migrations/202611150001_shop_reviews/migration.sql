BEGIN;
CREATE TABLE "ShopReview" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "productId" TEXT NOT NULL,
 "orderId" TEXT NOT NULL,
 "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
 "comment" TEXT NOT NULL DEFAULT '' CHECK (char_length("comment") <= 1000),
 "authorName" TEXT NOT NULL CHECK (char_length("authorName") <= 80),
 "status" TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK ("status" IN ('PUBLISHED','REPORTED','REMOVED')),
 "reportReason" TEXT CHECK ("reportReason" IS NULL OR "reportReason" IN ('ABUSE','PERSONAL_DATA','OFF_TOPIC')),
 "reportedAt" TIMESTAMP(3),
 "merchantReply" TEXT CHECK ("merchantReply" IS NULL OR char_length("merchantReply") <= 600),
 "repliedAt" TIMESTAMP(3),
 "moderatedAt" TIMESTAMP(3),
 "moderatedBy" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ShopReview_shopId_orderId_productId_key" ON "ShopReview"("shopId","orderId","productId");
CREATE INDEX "ShopReview_shopId_productId_status_idx" ON "ShopReview"("shopId","productId","status");
CREATE INDEX "ShopReview_status_reportedAt_idx" ON "ShopReview"("status","reportedAt");
COMMIT;
