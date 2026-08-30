CREATE TABLE "TableCheck" (
    "id" TEXT NOT NULL,
    "checkNumber" INTEGER NOT NULL,
    "tableId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "TableCheck_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
ADD COLUMN "tableCheckId" TEXT,
ADD COLUMN "tableCheckRound" INTEGER;

CREATE UNIQUE INDEX "TableCheck_checkNumber_key"
ON "TableCheck"("checkNumber");

CREATE INDEX "TableCheck_tableId_closedAt_createdAt_idx"
ON "TableCheck"("tableId", "closedAt", "createdAt");

CREATE UNIQUE INDEX "Order_tableCheckId_tableCheckRound_key"
ON "Order"("tableCheckId", "tableCheckRound");

CREATE INDEX "Order_tableCheckId_createdAt_idx"
ON "Order"("tableCheckId", "createdAt");

ALTER TABLE "TableCheck"
ADD CONSTRAINT "TableCheck_tableId_fkey"
FOREIGN KEY ("tableId") REFERENCES "Table"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_tableCheckId_fkey"
FOREIGN KEY ("tableCheckId") REFERENCES "TableCheck"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_table_check_round_pair_check"
CHECK (
  ("tableCheckId" IS NULL AND "tableCheckRound" IS NULL)
  OR
  ("tableCheckId" IS NOT NULL AND "tableCheckRound" IS NOT NULL AND "tableCheckRound" > 0)
);
