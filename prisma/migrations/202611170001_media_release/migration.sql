BEGIN;
-- A released row keeps only its verified filesystem copy. PostgreSQL still owns metadata and access control.
ALTER TABLE "ProductMedia" ALTER COLUMN "content" DROP NOT NULL, ADD COLUMN "contentReleasedAt" TIMESTAMP(3);
ALTER TABLE "ShopMedia" ALTER COLUMN "content" DROP NOT NULL, ADD COLUMN "contentReleasedAt" TIMESTAMP(3);
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_content_or_copy" CHECK (
 "content" IS NOT NULL OR ("storageKey" IS NOT NULL AND "contentSha256" IS NOT NULL AND "contentReleasedAt" IS NOT NULL));
ALTER TABLE "ShopMedia" ADD CONSTRAINT "ShopMedia_content_or_copy" CHECK (
 "content" IS NOT NULL OR ("storageKey" IS NOT NULL AND "contentSha256" IS NOT NULL AND "contentReleasedAt" IS NOT NULL));

CREATE OR REPLACE FUNCTION validate_media_mirror() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."content" IS NULL THEN
  -- Released: only allowed from a row whose bytes matched this exact pointer, and the pointer can never change.
  IF TG_OP <> 'UPDATE' OR OLD."content" IS NULL AND (OLD."storageKey" IS DISTINCT FROM NEW."storageKey" OR
     OLD."contentSha256" IS DISTINCT FROM NEW."contentSha256" OR OLD."size" <> NEW."size") THEN
   RAISE EXCEPTION 'media_release_invalid';
  END IF;
  IF OLD."content" IS NOT NULL AND (
     NEW."storageKey" IS NULL OR NEW."contentSha256" IS NULL OR
     OLD."size" <> octet_length(OLD."content") OR NEW."size" <> OLD."size" OR
     NEW."contentSha256" <> encode(sha256(OLD."content"), 'hex') OR
     NEW."storageKey" <> 'v1/' || NEW."workspaceId" || '/' || NEW."contentSha256") THEN
   RAISE EXCEPTION 'media_release_invalid';
  END IF;
  NEW."contentReleasedAt" := coalesce(NEW."contentReleasedAt", OLD."contentReleasedAt", now());
  RETURN NEW;
 END IF;
 NEW."contentReleasedAt" := NULL;
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
COMMIT;
