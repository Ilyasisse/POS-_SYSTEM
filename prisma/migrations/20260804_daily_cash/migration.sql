CREATE TABLE "DailySalaryRate" (
  "id" TEXT NOT NULL,
  "effectiveBusinessDate" DATE NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailySalaryRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailySalaryRate_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "DailyCashDay" (
  "id" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "salaryAmount" DECIMAL(14,2) NOT NULL,
  "salaryRateId" TEXT,
  "salaryOverridden" BOOLEAN NOT NULL DEFAULT false,
  "salaryOverriddenByUserId" TEXT,
  "salaryOverriddenAt" TIMESTAMP(3),
  "salaryPaidAt" TIMESTAMP(3),
  "salaryPaidByUserId" TEXT,
  "salaryRevenueFunded" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "salarySavingsFunded" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "finalizedAt" TIMESTAMP(3),
  "finalizedByUserId" TEXT,
  "finalizationFingerprint" TEXT,
  "finalizedRevenue" DECIMAL(14,2),
  "finalizedPaidExpenses" DECIMAL(14,2),
  "finalizedUnpaidRequired" DECIMAL(14,2),
  "finalizedRemainingCash" DECIMAL(14,2),
  "finalizedSavingsUsed" DECIMAL(14,2),
  "finalizedAdditionalSavingsRequired" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyCashDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyCashDay_salaryAmount_check" CHECK ("salaryAmount" >= 0),
  CONSTRAINT "DailyCashDay_salaryFunding_check" CHECK (
    ("salaryPaidAt" IS NULL AND "salaryPaidByUserId" IS NULL AND "salaryRevenueFunded" = 0 AND "salarySavingsFunded" = 0)
    OR
    ("salaryPaidAt" IS NOT NULL AND "salaryPaidByUserId" IS NOT NULL AND "salaryRevenueFunded" + "salarySavingsFunded" = "salaryAmount")
  ),
  CONSTRAINT "DailyCashDay_finalization_snapshot_check" CHECK (
    num_nulls(
      "finalizedAt", "finalizedByUserId", "finalizationFingerprint", "finalizedRevenue",
      "finalizedPaidExpenses", "finalizedUnpaidRequired", "finalizedRemainingCash",
      "finalizedSavingsUsed", "finalizedAdditionalSavingsRequired"
    ) IN (0, 9)
  )
);

CREATE TABLE "DailyCashManualExpense" (
  "id" TEXT NOT NULL,
  "dailyCashDayId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "revenueFunded" DECIMAL(14,2) NOT NULL,
  "savingsFunded" DECIMAL(14,2) NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyCashManualExpense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyCashManualExpense_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "DailyCashManualExpense_funding_check" CHECK (
    "revenueFunded" >= 0 AND "savingsFunded" >= 0 AND "revenueFunded" + "savingsFunded" = "amount"
  )
);

CREATE TABLE "DailyCashSupplierPayment" (
  "id" TEXT NOT NULL,
  "dailyCashDayId" TEXT NOT NULL,
  "supplierPaymentId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "revenueFunded" DECIMAL(14,2) NOT NULL,
  "savingsFunded" DECIMAL(14,2) NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyCashSupplierPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyCashSupplierPayment_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "DailyCashSupplierPayment_funding_check" CHECK (
    "revenueFunded" >= 0 AND "savingsFunded" >= 0 AND "revenueFunded" + "savingsFunded" = "amount"
  )
);

CREATE UNIQUE INDEX "DailySalaryRate_effectiveBusinessDate_key"
  ON "DailySalaryRate"("effectiveBusinessDate");
CREATE INDEX "DailySalaryRate_createdByUserId_createdAt_idx"
  ON "DailySalaryRate"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "DailyCashDay_businessDate_key" ON "DailyCashDay"("businessDate");
CREATE INDEX "DailyCashDay_salaryRateId_idx" ON "DailyCashDay"("salaryRateId");
CREATE INDEX "DailyCashDay_salaryPaidByUserId_idx" ON "DailyCashDay"("salaryPaidByUserId");
CREATE INDEX "DailyCashDay_finalizedByUserId_idx" ON "DailyCashDay"("finalizedByUserId");
CREATE INDEX "DailyCashManualExpense_dailyCashDayId_createdAt_idx"
  ON "DailyCashManualExpense"("dailyCashDayId", "createdAt");
CREATE INDEX "DailyCashManualExpense_createdByUserId_createdAt_idx"
  ON "DailyCashManualExpense"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "DailyCashSupplierPayment_supplierPaymentId_key"
  ON "DailyCashSupplierPayment"("supplierPaymentId");
CREATE INDEX "DailyCashSupplierPayment_dailyCashDayId_createdAt_idx"
  ON "DailyCashSupplierPayment"("dailyCashDayId", "createdAt");
CREATE INDEX "DailyCashSupplierPayment_recordedByUserId_createdAt_idx"
  ON "DailyCashSupplierPayment"("recordedByUserId", "createdAt");

ALTER TABLE "DailySalaryRate"
  ADD CONSTRAINT "DailySalaryRate_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashDay"
  ADD CONSTRAINT "DailyCashDay_salaryRateId_fkey"
  FOREIGN KEY ("salaryRateId") REFERENCES "DailySalaryRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashDay"
  ADD CONSTRAINT "DailyCashDay_salaryOverriddenByUserId_fkey"
  FOREIGN KEY ("salaryOverriddenByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashDay"
  ADD CONSTRAINT "DailyCashDay_salaryPaidByUserId_fkey"
  FOREIGN KEY ("salaryPaidByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashDay"
  ADD CONSTRAINT "DailyCashDay_finalizedByUserId_fkey"
  FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashManualExpense"
  ADD CONSTRAINT "DailyCashManualExpense_dailyCashDayId_fkey"
  FOREIGN KEY ("dailyCashDayId") REFERENCES "DailyCashDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyCashManualExpense"
  ADD CONSTRAINT "DailyCashManualExpense_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashSupplierPayment"
  ADD CONSTRAINT "DailyCashSupplierPayment_dailyCashDayId_fkey"
  FOREIGN KEY ("dailyCashDayId") REFERENCES "DailyCashDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyCashSupplierPayment"
  ADD CONSTRAINT "DailyCashSupplierPayment_supplierPaymentId_fkey"
  FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashSupplierPayment"
  ADD CONSTRAINT "DailyCashSupplierPayment_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
