-- Additive storage for strictly bounded merchant brand images (logo + banner).
-- This table is independent from legacy Workspace.data/order/stock formats.
CREATE TABLE "ShopMedia" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopMedia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShopMedia_workspaceId_slot_key" UNIQUE ("workspaceId", "slot"),
    CONSTRAINT "ShopMedia_valid_slot" CHECK ("slot" IN ('logo','banner')),
    CONSTRAINT "ShopMedia_max_size" CHECK ("size" > 0 AND "size" <= 2097152),
    CONSTRAINT "ShopMedia_dimensions" CHECK ("width" BETWEEN 1 AND 6000 AND "height" BETWEEN 1 AND 6000)
);
ALTER TABLE "ShopMedia" ADD CONSTRAINT "ShopMedia_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
