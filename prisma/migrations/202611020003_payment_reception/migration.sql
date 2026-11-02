-- Configure official SaaS payment reception only AFTER explicit global ADMIN setup.
-- No fabricated D17 phone, bank account, RIB, or cash location is installed.
CREATE TABLE "PaymentReceptionMethod" (
 "code" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
 "recipientName" TEXT NOT NULL DEFAULT '',
 "identifier" TEXT NOT NULL DEFAULT '',
 "bankName" TEXT NOT NULL DEFAULT '',
 "instructions" TEXT NOT NULL DEFAULT '',
 "version" INTEGER NOT NULL DEFAULT 0,
 "updatedById" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PaymentReceptionMethod_pkey" PRIMARY KEY ("code"),
 CONSTRAINT "PaymentReceptionMethod_valid_code" CHECK ("code" IN ('D17','BANK_TRANSFER','CASH'))
);
CREATE TABLE "PaymentReceptionAudit" (
 "id" TEXT NOT NULL,
 "actorId" TEXT NOT NULL,
 "methodCode" TEXT NOT NULL,
 "oldVersion" INTEGER NOT NULL,
 "nextVersion" INTEGER NOT NULL,
 "changed" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PaymentReceptionAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentReceptionAudit_methodCode_createdAt_idx" ON "PaymentReceptionAudit"("methodCode","createdAt");
INSERT INTO "PaymentReceptionMethod" (
 "code","enabled","recipientName","identifier","bankName","instructions","version","updatedAt"
) VALUES
 ('D17',FALSE,'','','','',0,NOW()),
 ('BANK_TRANSFER',FALSE,'','','','',0,NOW()),
 ('CASH',FALSE,'','','','',0,NOW())
ON CONFLICT ("code") DO NOTHING;
