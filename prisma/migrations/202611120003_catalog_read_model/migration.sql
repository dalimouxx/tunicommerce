-- Add metadata without rewriting the historical commerce JSON.
ALTER TABLE "Workspace" ADD COLUMN "catalogVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShopCommerce" ADD COLUMN "catalogVersion" INTEGER NOT NULL DEFAULT 0;

-- Every writer participates, including older code paths that do not know the index.
CREATE FUNCTION tc_bump_catalog_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."data" -> 'products' IS DISTINCT FROM OLD."data" -> 'products' THEN
  NEW."catalogVersion" := OLD."catalogVersion" + 1;
 ELSE
  NEW."catalogVersion" := OLD."catalogVersion";
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER tc_workspace_catalog_version BEFORE UPDATE ON "Workspace"
 FOR EACH ROW EXECUTE FUNCTION tc_bump_catalog_version();
CREATE TRIGGER tc_shop_catalog_version BEFORE UPDATE ON "ShopCommerce"
 FOR EACH ROW EXECUTE FUNCTION tc_bump_catalog_version();

CREATE TABLE "ShopCatalogIndex" (
 "shopId" TEXT NOT NULL PRIMARY KEY,
 "sourceKind" TEXT NOT NULL,
 "sourceId" TEXT NOT NULL,
 "sourceVersion" INTEGER NOT NULL,
 "productCount" INTEGER NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ShopCatalogIndex_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ShopCatalogProduct" (
 "shopId" TEXT NOT NULL,
 "productId" TEXT NOT NULL,
 "ordinal" INTEGER NOT NULL,
 "name" TEXT NOT NULL,
 "sku" TEXT NOT NULL,
 "category" TEXT NOT NULL,
 "variant" TEXT NOT NULL,
 "price" BIGINT NOT NULL,
 "cost" BIGINT NOT NULL,
 "stock" BIGINT NOT NULL,
 "threshold" BIGINT NOT NULL,
 "color" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL,
 "lowStock" BOOLEAN NOT NULL,
 "searchText" TEXT NOT NULL,
 "extra" JSONB NOT NULL DEFAULT '{}',
 PRIMARY KEY ("shopId","productId"),
 CONSTRAINT "ShopCatalogProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "ShopCatalogIndex"("shopId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ShopCatalogProduct_shopId_ordinal_idx" ON "ShopCatalogProduct"("shopId","ordinal");
CREATE INDEX "ShopCatalogProduct_shopId_active_ordinal_idx" ON "ShopCatalogProduct"("shopId","active","ordinal");
CREATE INDEX "ShopCatalogProduct_shopId_lowStock_ordinal_idx" ON "ShopCatalogProduct"("shopId","lowStock","ordinal");
