BEGIN;
ALTER TABLE "ShopDomainClaim" ADD COLUMN "ownerId" TEXT;
UPDATE "ShopDomainClaim" c SET "ownerId"=o."ownerId" FROM "Shop" s JOIN "Organization" o ON o."id"=s."organizationId" WHERE s."id"=c."shopId";
ALTER TABLE "ShopDomainBinding" ADD COLUMN "ownerId" TEXT,
 ADD COLUMN "proofStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
 ADD COLUMN "lastError" TEXT,
 ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
 ADD COLUMN "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "checkLeaseId" TEXT,
 ADD COLUMN "checkLockedUntil" TIMESTAMP(3);
UPDATE "ShopDomainBinding" b SET "ownerId"=o."ownerId", "lastCheckedAt"=b."verifiedAt"
 FROM "Shop" s JOIN "Organization" o ON o."id"=s."organizationId" WHERE s."id"=b."shopId";
-- Old application instances omit the new snapshot on INSERT during a rolling
-- deployment. Fill it once; never rewrite an existing snapshot on UPDATE.
CREATE FUNCTION initialize_domain_owner_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."ownerId" IS NULL THEN
  SELECT o."ownerId" INTO NEW."ownerId" FROM "Shop" s JOIN "Organization" o ON o."id"=s."organizationId" WHERE s."id"=NEW."shopId";
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER domain_claim_owner_snapshot BEFORE INSERT OR UPDATE ON "ShopDomainClaim"
 FOR EACH ROW EXECUTE FUNCTION initialize_domain_owner_snapshot();
CREATE TRIGGER domain_binding_owner_snapshot BEFORE INSERT OR UPDATE ON "ShopDomainBinding"
 FOR EACH ROW EXECUTE FUNCTION initialize_domain_owner_snapshot();
ALTER TABLE "ShopDomainClaim" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "ShopDomainBinding" ALTER COLUMN "ownerId" SET NOT NULL;
CREATE INDEX "ShopDomainBinding_nextCheckAt_idx" ON "ShopDomainBinding"("nextCheckAt");
COMMIT;
