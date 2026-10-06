CREATE TYPE "CashDrawerDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "CashDrawerMovement" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "direction" "CashDrawerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashDrawerMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CashDrawerMovement_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "CashDrawerMovement_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 3 AND 250)
);

CREATE UNIQUE INDEX "CashDrawerMovement_idempotencyKey_key" ON "CashDrawerMovement"("idempotencyKey");
CREATE INDEX "CashDrawerMovement_createdAt_idx" ON "CashDrawerMovement"("createdAt");
CREATE INDEX "CashDrawerMovement_recordedById_createdAt_idx" ON "CashDrawerMovement"("recordedById", "createdAt");
ALTER TABLE "CashDrawerMovement" ADD CONSTRAINT "CashDrawerMovement_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
