-- Prevent overlapping scheduler invocations from concurrently sending the same
-- Twilio delivery. Expired leases may be reclaimed after an interrupted run.
CREATE TABLE "SchedulerLease" (
    "key" TEXT NOT NULL,
    "ownerToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLease_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "SchedulerLease_expiresAt_idx" ON "SchedulerLease"("expiresAt");
