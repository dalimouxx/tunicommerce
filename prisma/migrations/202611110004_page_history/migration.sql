-- Preserve all existing page drafts, publication snapshots and addresses.
ALTER TABLE "ShopPage" ADD COLUMN "history" JSONB NOT NULL DEFAULT '[]';
