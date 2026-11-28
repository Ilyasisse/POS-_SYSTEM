CREATE TYPE "StaffAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'AWAY', 'OFFLINE');
ALTER TABLE "Staff" ADD COLUMN "availability" "StaffAvailability" NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "CustomerCheckout" ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'TAKEOUT',
  ADD COLUMN "tableId" TEXT;
ALTER TABLE "CustomerCheckout" ADD CONSTRAINT "CustomerCheckout_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Staff_role_availability_lastSeenAt_idx" ON "Staff"("role", "availability", "lastSeenAt");
CREATE INDEX "CustomerCheckout_tableId_idx" ON "CustomerCheckout"("tableId");
