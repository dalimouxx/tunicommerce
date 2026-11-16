ALTER TABLE "ShopDomainBinding" ADD COLUMN "primary" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "ShopDomainBinding_one_primary_per_shop" ON "ShopDomainBinding" ("shopId") WHERE "primary" = true;
