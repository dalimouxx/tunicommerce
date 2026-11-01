ALTER TABLE "PublicReceipt" ADD COLUMN "customerId" TEXT;
CREATE INDEX "PublicReceipt_customerId_createdAt_idx" ON "PublicReceipt"("customerId", "createdAt");
ALTER TABLE "PublicReceipt" ADD CONSTRAINT "PublicReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
