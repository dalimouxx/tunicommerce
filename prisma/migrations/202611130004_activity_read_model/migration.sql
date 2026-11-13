BEGIN;
ALTER TABLE "Workspace" ADD COLUMN "activityVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShopCommerce" ADD COLUMN "activityVersion" INTEGER NOT NULL DEFAULT 0;
CREATE FUNCTION tc_bump_activity_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."data" -> 'orders' IS DISTINCT FROM OLD."data" -> 'orders'
 OR NEW."data" -> 'customers' IS DISTINCT FROM OLD."data" -> 'customers' THEN
  NEW."activityVersion" := OLD."activityVersion" + 1;
 ELSE
  NEW."activityVersion" := OLD."activityVersion";
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER tc_workspace_activity_version BEFORE UPDATE ON "Workspace" FOR EACH ROW EXECUTE FUNCTION tc_bump_activity_version();
CREATE TRIGGER tc_shop_activity_version BEFORE UPDATE ON "ShopCommerce" FOR EACH ROW EXECUTE FUNCTION tc_bump_activity_version();
CREATE TABLE "ShopActivityIndex" (
 "shopId" TEXT NOT NULL PRIMARY KEY REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "sourceKind" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "sourceVersion" INTEGER NOT NULL,
 "orderCount" INTEGER NOT NULL, "customerCount" INTEGER NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ShopActivityOrder" (
 "shopId" TEXT NOT NULL REFERENCES "ShopActivityIndex"("shopId") ON DELETE CASCADE ON UPDATE CASCADE,
 "orderId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL, "reference" TEXT NOT NULL, "customerId" TEXT NOT NULL,
 "status" TEXT NOT NULL, "source" TEXT NOT NULL, "total" BIGINT NOT NULL, "collected" BIGINT NOT NULL,
 "createdAt" TEXT NOT NULL, "customerName" TEXT NOT NULL, "customerPhone" TEXT NOT NULL, "customerCity" TEXT NOT NULL,
 "searchText" TEXT NOT NULL, "extra" JSONB NOT NULL DEFAULT '{}', PRIMARY KEY ("shopId","orderId")
);
CREATE INDEX "ShopActivityOrder_shopId_ordinal_idx" ON "ShopActivityOrder"("shopId","ordinal");
CREATE INDEX "ShopActivityOrder_shopId_status_ordinal_idx" ON "ShopActivityOrder"("shopId","status","ordinal");
CREATE INDEX "ShopActivityOrder_shopId_customerId_idx" ON "ShopActivityOrder"("shopId","customerId");
CREATE TABLE "ShopActivityCustomer" (
 "shopId" TEXT NOT NULL REFERENCES "ShopActivityIndex"("shopId") ON DELETE CASCADE ON UPDATE CASCADE,
 "customerId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL, "name" TEXT NOT NULL, "phone" TEXT NOT NULL,
 "city" TEXT NOT NULL, "address" TEXT NOT NULL, "notes" TEXT NOT NULL, "orderCount" INTEGER NOT NULL,
 "deliveredCount" INTEGER NOT NULL, "deliveredGross" BIGINT NOT NULL, "searchText" TEXT NOT NULL,
 "extra" JSONB NOT NULL DEFAULT '{}', PRIMARY KEY ("shopId","customerId")
);
CREATE INDEX "ShopActivityCustomer_shopId_ordinal_idx" ON "ShopActivityCustomer"("shopId","ordinal");
COMMIT;
