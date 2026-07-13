ALTER TABLE "Shift"
ADD COLUMN "businessDate" DATE,
ADD COLUMN "reportedSales" DECIMAL(65,30),
ADD COLUMN "settledByUserId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "WaiterBalanceInitialization" (
    "id" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "effectiveBusinessDate" DATE NOT NULL,
    "openingBalance" DECIMAL(65,30) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaiterBalanceInitialization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shift_userId_businessDate_key"
ON "Shift"("userId", "businessDate");

CREATE INDEX "Shift_settledByUserId_idx"
ON "Shift"("settledByUserId");

CREATE UNIQUE INDEX "WaiterBalanceInitialization_waiterId_key"
ON "WaiterBalanceInitialization"("waiterId");

CREATE INDEX "WaiterBalanceInitialization_createdByUserId_idx"
ON "WaiterBalanceInitialization"("createdByUserId");

ALTER TABLE "Shift"
ADD CONSTRAINT "Shift_settledByUserId_fkey"
FOREIGN KEY ("settledByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaiterBalanceInitialization"
ADD CONSTRAINT "WaiterBalanceInitialization_waiterId_fkey"
FOREIGN KEY ("waiterId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WaiterBalanceInitialization"
ADD CONSTRAINT "WaiterBalanceInitialization_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
