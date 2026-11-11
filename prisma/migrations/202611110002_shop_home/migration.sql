CREATE TABLE "ShopHome" (
  "shopId" TEXT NOT NULL,
  "draft" JSONB NOT NULL,
  "published" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedVersion" INTEGER,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopHome_pkey" PRIMARY KEY ("shopId"),
  CONSTRAINT "ShopHome_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
