-- Additive invitation table. Existing users, shops, memberships and commerce data are untouched.
CREATE TABLE "ShopInvitation" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShopInvitation_shopId_email_key" ON "ShopInvitation"("shopId","email");
CREATE INDEX "ShopInvitation_email_acceptedAt_revokedAt_expiresAt_idx" ON "ShopInvitation"("email","acceptedAt","revokedAt","expiresAt");
ALTER TABLE "ShopInvitation" ADD CONSTRAINT "ShopInvitation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
