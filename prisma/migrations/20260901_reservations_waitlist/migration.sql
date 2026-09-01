CREATE TYPE "ReservationStatus" AS ENUM (
  'BOOKED',
  'WAITING',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
);

CREATE TABLE "Reservation" (
  "id" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "phone" TEXT,
  "partySize" INTEGER NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "status" "ReservationStatus" NOT NULL DEFAULT 'BOOKED',
  "tableId" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "seatedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Reservation_partySize_check" CHECK ("partySize" BETWEEN 1 AND 50),
  CONSTRAINT "Reservation_booked_schedule_check" CHECK (
    "status" <> 'BOOKED' OR "scheduledAt" IS NOT NULL
  )
);

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_tableId_fkey"
FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Reservation_status_scheduledAt_idx" ON "Reservation"("status", "scheduledAt");
CREATE INDEX "Reservation_tableId_status_idx" ON "Reservation"("tableId", "status");
CREATE INDEX "Reservation_phone_createdAt_idx" ON "Reservation"("phone", "createdAt");
CREATE INDEX "Reservation_createdByUserId_createdAt_idx" ON "Reservation"("createdByUserId", "createdAt");
