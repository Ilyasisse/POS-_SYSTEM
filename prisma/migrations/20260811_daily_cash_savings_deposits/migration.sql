CREATE TABLE "DailyCashSavingsDeposit" (
  "id" TEXT NOT NULL,
  "dailyCashDayId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyCashSavingsDeposit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyCashSavingsDeposit_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "DailyCashSavingsDeposit_dailyCashDayId_createdAt_idx" ON "DailyCashSavingsDeposit"("dailyCashDayId", "createdAt");
CREATE INDEX "DailyCashSavingsDeposit_recordedByUserId_createdAt_idx" ON "DailyCashSavingsDeposit"("recordedByUserId", "createdAt");

ALTER TABLE "DailyCashSavingsDeposit" ADD CONSTRAINT "DailyCashSavingsDeposit_dailyCashDayId_fkey" FOREIGN KEY ("dailyCashDayId") REFERENCES "DailyCashDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyCashSavingsDeposit" ADD CONSTRAINT "DailyCashSavingsDeposit_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
