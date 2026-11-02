-- Manual SaaS renewals: immutable price/duration snapshots, merchant declaration and admin confirmation.
-- Additive migration: no change to historical shops, subscriptions, COD or order data.
CREATE TABLE "SubscriptionPayment" (
 "id" TEXT NOT NULL,
 "reference" TEXT NOT NULL,
 "requestId" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "requesterId" TEXT NOT NULL,
 "planCode" TEXT NOT NULL,
 "planName" TEXT NOT NULL,
 "priceMillimes" INTEGER NOT NULL,
 "durationDays" INTEGER NOT NULL,
 "method" TEXT NOT NULL,
 "transferReference" TEXT,
 "merchantNote" TEXT NOT NULL DEFAULT '',
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "adminNote" TEXT NOT NULL DEFAULT '',
 "decidedById" TEXT,
 "decidedAt" TIMESTAMP(3),
 "periodStartsAt" TIMESTAMP(3),
 "periodEndsAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SubscriptionPayment_amount" CHECK ("priceMillimes" > 0 AND "durationDays" BETWEEN 1 AND 3650),
 CONSTRAINT "SubscriptionPayment_status" CHECK ("status" IN ('PENDING','APPROVED','REJECTED')),
 CONSTRAINT "SubscriptionPayment_method" CHECK ("method" IN ('D17','BANK_TRANSFER','CASH')),
 CONSTRAINT "SubscriptionPayment_transfer_reference" CHECK (
  "method"='CASH' OR ("transferReference" IS NOT NULL AND length("transferReference") BETWEEN 6 AND 120)
 )
);
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_workspaceId_fkey"
 FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SubscriptionPayment_reference_key" ON "SubscriptionPayment"("reference");
CREATE UNIQUE INDEX "SubscriptionPayment_workspaceId_requestId_key" ON "SubscriptionPayment"("workspaceId","requestId");
CREATE INDEX "SubscriptionPayment_workspaceId_createdAt_idx" ON "SubscriptionPayment"("workspaceId","createdAt");
CREATE INDEX "SubscriptionPayment_status_createdAt_idx" ON "SubscriptionPayment"("status","createdAt");
-- Only one pending request per boutique. A denied request can be resubmitted.
CREATE UNIQUE INDEX "SubscriptionPayment_one_pending_per_workspace" ON "SubscriptionPayment"("workspaceId") WHERE "status"='PENDING';
-- Prevent approving the exact same D17/bank transfer reference twice globally.
CREATE UNIQUE INDEX "SubscriptionPayment_one_approved_external_reference" ON
 "SubscriptionPayment"("method","transferReference")
 WHERE "status"='APPROVED' AND "method" IN ('D17','BANK_TRANSFER');
