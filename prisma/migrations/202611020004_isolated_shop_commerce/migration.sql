-- Additive: old Workspace data and subscriptions are untouched.
CREATE TABLE "ShopCommerce" (
 "shopId" TEXT NOT NULL,
 "data" JSONB NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ShopCommerce_pkey" PRIMARY KEY ("shopId")
);
ALTER TABLE "ShopCommerce" ADD CONSTRAINT "ShopCommerce_shopId_fkey"
 FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
