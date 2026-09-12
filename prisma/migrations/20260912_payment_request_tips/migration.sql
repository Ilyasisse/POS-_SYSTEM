ALTER TABLE "PaymentRequest"
ADD COLUMN "billAmount" DECIMAL(14,2),
ADD COLUMN "tipAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "tipRecipientId" TEXT,
ADD COLUMN "tipRecipientName" TEXT;

UPDATE "PaymentRequest"
SET "billAmount" = "expectedAmount";

ALTER TABLE "PaymentRequest"
ALTER COLUMN "billAmount" SET NOT NULL;

ALTER TABLE "PaymentRequest"
ADD CONSTRAINT "PaymentRequest_tipRecipientId_fkey"
FOREIGN KEY ("tipRecipientId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PaymentRequest_tipRecipientId_matchedAt_idx"
ON "PaymentRequest"("tipRecipientId", "matchedAt");
