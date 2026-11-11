CREATE TABLE "ShopDomainClaim" (
 "id" TEXT NOT NULL, "shopId" TEXT NOT NULL, "hostname" TEXT NOT NULL, "token" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ShopDomainClaim_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ShopDomainBinding" (
 "hostname" TEXT NOT NULL, "shopId" TEXT NOT NULL, "claimId" TEXT NOT NULL, "verifiedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ShopDomainBinding_pkey" PRIMARY KEY ("hostname")
);
CREATE UNIQUE INDEX "ShopDomainClaim_shopId_hostname_key" ON "ShopDomainClaim"("shopId","hostname");
CREATE INDEX "ShopDomainClaim_shopId_idx" ON "ShopDomainClaim"("shopId");
CREATE UNIQUE INDEX "ShopDomainBinding_claimId_key" ON "ShopDomainBinding"("claimId");
CREATE INDEX "ShopDomainBinding_shopId_idx" ON "ShopDomainBinding"("shopId");
ALTER TABLE "ShopDomainClaim" ADD CONSTRAINT "ShopDomainClaim_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopDomainBinding" ADD CONSTRAINT "ShopDomainBinding_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopDomainBinding" ADD CONSTRAINT "ShopDomainBinding_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ShopDomainClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
