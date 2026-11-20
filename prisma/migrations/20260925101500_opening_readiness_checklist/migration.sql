CREATE TABLE "OpeningReadinessDay" (
  "businessDate" DATE NOT NULL,
  "startedByUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signedByUserId" TEXT,
  "signedAt" TIMESTAMP(3),
  CONSTRAINT "OpeningReadinessDay_pkey" PRIMARY KEY ("businessDate"),
  CONSTRAINT "OpeningReadinessDay_signature_check" CHECK (("signedAt" IS NULL) = ("signedByUserId" IS NULL))
);

CREATE TABLE "OpeningReadinessTask" (
  "businessDate" DATE NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3),
  "checkedByUserId" TEXT,
  CONSTRAINT "OpeningReadinessTask_pkey" PRIMARY KEY ("businessDate", "key"),
  CONSTRAINT "OpeningReadinessTask_check_pair" CHECK (("checkedAt" IS NULL) = ("checkedByUserId" IS NULL))
);

CREATE INDEX "OpeningReadinessDay_signedAt_idx" ON "OpeningReadinessDay"("signedAt");
CREATE INDEX "OpeningReadinessTask_checkedByUserId_idx" ON "OpeningReadinessTask"("checkedByUserId");
ALTER TABLE "OpeningReadinessDay" ADD CONSTRAINT "OpeningReadinessDay_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpeningReadinessDay" ADD CONSTRAINT "OpeningReadinessDay_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpeningReadinessTask" ADD CONSTRAINT "OpeningReadinessTask_businessDate_fkey" FOREIGN KEY ("businessDate") REFERENCES "OpeningReadinessDay"("businessDate") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpeningReadinessTask" ADD CONSTRAINT "OpeningReadinessTask_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Operational records are accessed only through permission-checked server code.
ALTER TABLE "OpeningReadinessDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OpeningReadinessTask" ENABLE ROW LEVEL SECURITY;
