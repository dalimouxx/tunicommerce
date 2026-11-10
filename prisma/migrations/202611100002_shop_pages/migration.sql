CREATE TABLE "ShopPage" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "slug" TEXT NOT NULL,"draft" JSONB NOT NULL,"published" JSONB,
 "version" INTEGER NOT NULL DEFAULT 0,"publishedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ShopPage_shopId_slug_key" ON "ShopPage"("shopId","slug");
CREATE INDEX "ShopPage_shopId_publishedAt_idx" ON "ShopPage"("shopId","publishedAt");
