-- Additive, small media pilot. Does not alter existing products, orders or brand-media assets.
CREATE TABLE "ProductMedia" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductMedia_size_limit" CHECK ("size" BETWEEN 1 AND 409600),
  CONSTRAINT "ProductMedia_mime" CHECK ("mimeType" IN ('image/jpeg','image/png','image/webp')),
  CONSTRAINT "ProductMedia_dimensions" CHECK ("width" BETWEEN 1 AND 2400 AND "height" BETWEEN 1 AND 2400),
  CONSTRAINT "ProductMedia_pixel_limit" CHECK (("width"::bigint * "height"::bigint) <= 4000000)
);
CREATE INDEX "ProductMedia_workspaceId_createdAt_idx" ON "ProductMedia"("workspaceId", "createdAt");
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
