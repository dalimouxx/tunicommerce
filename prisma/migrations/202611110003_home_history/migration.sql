-- Existing homes retain their draft and published snapshot unchanged.
ALTER TABLE "ShopHome" ADD COLUMN "history" JSONB NOT NULL DEFAULT '[]';
