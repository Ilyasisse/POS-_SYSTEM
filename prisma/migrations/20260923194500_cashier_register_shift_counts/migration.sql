CREATE TABLE "CashierRegisterShift" (
    "id" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCash" DECIMAL(14,2) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closingCash" DECIMAL(14,2),
    "closingNote" TEXT,
    CONSTRAINT "CashierRegisterShift_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CashierRegisterShift_counts_check" CHECK (
        "openingCash" >= 0 AND
        ("closedAt" IS NULL AND "closingCash" IS NULL OR "closedAt" IS NOT NULL AND "closingCash" IS NOT NULL AND "closingCash" >= 0)
    ),
    CONSTRAINT "CashierRegisterShift_note_check" CHECK ("closingNote" IS NULL OR char_length("closingNote") <= 500)
);

CREATE INDEX "CashierRegisterShift_cashierId_openedAt_idx" ON "CashierRegisterShift"("cashierId", "openedAt");
CREATE INDEX "CashierRegisterShift_closedAt_openedAt_idx" ON "CashierRegisterShift"("closedAt", "openedAt");
CREATE UNIQUE INDEX "CashierRegisterShift_one_open_per_cashier" ON "CashierRegisterShift"("cashierId") WHERE "closedAt" IS NULL;
ALTER TABLE "CashierRegisterShift" ADD CONSTRAINT "CashierRegisterShift_cashierId_fkey"
    FOREIGN KEY ("cashierId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
