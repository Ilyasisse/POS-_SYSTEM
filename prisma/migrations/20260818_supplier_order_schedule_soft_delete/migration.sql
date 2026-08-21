-- Preserve supplier-order history while removing deleted schedules from active use.
ALTER TABLE "SupplierOrderSchedule"
ADD COLUMN "deletedAt" TIMESTAMP(3);
