ALTER TABLE "ProductMedia" ADD COLUMN "storageKey" TEXT, ADD COLUMN "contentSha256" TEXT;
ALTER TABLE "ShopMedia" ADD COLUMN "storageKey" TEXT, ADD COLUMN "contentSha256" TEXT;

-- Keep canonical bytes. A stale or forged mirror pointer must never serve another image.
CREATE FUNCTION validate_media_mirror() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."storageKey" IS NULL OR NEW."contentSha256" IS NULL OR
    NEW."size" <> octet_length(NEW."content") OR
    NEW."contentSha256" <> encode(sha256(NEW."content"), 'hex') OR
    NEW."storageKey" <> 'v1/' || NEW."workspaceId" || '/' || NEW."contentSha256" THEN
  NEW."storageKey" := NULL;
  NEW."contentSha256" := NULL;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER product_media_mirror BEFORE INSERT OR UPDATE ON "ProductMedia"
 FOR EACH ROW EXECUTE FUNCTION validate_media_mirror();
CREATE TRIGGER shop_media_mirror BEFORE INSERT OR UPDATE ON "ShopMedia"
 FOR EACH ROW EXECUTE FUNCTION validate_media_mirror();
