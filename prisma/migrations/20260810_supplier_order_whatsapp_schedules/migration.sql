CREATE TYPE "SupplierOrderRecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');
CREATE TYPE "SupplierOrderRunStatus" AS ENUM ('SCHEDULED', 'COLLECTING', 'FINALIZING', 'SENT', 'SKIPPED', 'FAILED', 'CANCELLED');
CREATE TYPE "SupplierOrderRecipientStatus" AS ENUM ('PENDING', 'RESPONDED', 'NO_ORDER');
CREATE TYPE "SupplierOrderWhatsAppMessageType" AS ENUM ('INVITATION', 'REMINDER', 'SUPPLIER_ORDER');
CREATE TYPE "WhatsAppDeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DELIVERED', 'READ', 'FAILED');

CREATE TABLE "SupplierOrderSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "firstInviteAt" TIMESTAMP(3) NOT NULL,
    "firstSupplierSendAt" TIMESTAMP(3) NOT NULL,
    "nextInviteAt" TIMESTAMP(3),
    "nextSupplierSendAt" TIMESTAMP(3),
    "reminderIntervalMinutes" INTEGER NOT NULL,
    "recurrenceUnit" "SupplierOrderRecurrenceUnit",
    "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
    "endAt" TIMESTAMP(3),
    "deliveryLeadDays" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierOrderSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierOrderScheduleRecipient" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierOrderScheduleRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierOrderRun" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierPhone" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "inviteAt" TIMESTAMP(3) NOT NULL,
    "supplierSendAt" TIMESTAMP(3) NOT NULL,
    "reminderIntervalMinutes" INTEGER NOT NULL,
    "deliveryLeadDays" INTEGER NOT NULL,
    "status" "SupplierOrderRunStatus" NOT NULL DEFAULT 'SCHEDULED',
    "purchaseOrderId" TEXT,
    "failureReason" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierOrderRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierOrderRunRecipient" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "SupplierOrderRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierOrderRunRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierOrderResponseItem" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "supplierCatalogItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierOrderResponseItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierOrderWhatsAppDelivery" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "recipientId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "type" "SupplierOrderWhatsAppMessageType" NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "status" "WhatsAppDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "metaMessageId" TEXT,
    "mediaId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierOrderWhatsAppDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierOrderSchedule_isActive_nextInviteAt_idx" ON "SupplierOrderSchedule"("isActive", "nextInviteAt");
CREATE INDEX "SupplierOrderSchedule_supplierId_isActive_idx" ON "SupplierOrderSchedule"("supplierId", "isActive");
CREATE INDEX "SupplierOrderSchedule_createdByUserId_createdAt_idx" ON "SupplierOrderSchedule"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "SupplierOrderScheduleRecipient_scheduleId_userId_key" ON "SupplierOrderScheduleRecipient"("scheduleId", "userId");
CREATE INDEX "SupplierOrderScheduleRecipient_userId_idx" ON "SupplierOrderScheduleRecipient"("userId");
CREATE UNIQUE INDEX "SupplierOrderRun_purchaseOrderId_key" ON "SupplierOrderRun"("purchaseOrderId");
CREATE UNIQUE INDEX "SupplierOrderRun_scheduleId_sequence_key" ON "SupplierOrderRun"("scheduleId", "sequence");
CREATE INDEX "SupplierOrderRun_status_inviteAt_idx" ON "SupplierOrderRun"("status", "inviteAt");
CREATE INDEX "SupplierOrderRun_status_supplierSendAt_idx" ON "SupplierOrderRun"("status", "supplierSendAt");
CREATE INDEX "SupplierOrderRun_supplierId_createdAt_idx" ON "SupplierOrderRun"("supplierId", "createdAt");
CREATE UNIQUE INDEX "SupplierOrderRunRecipient_tokenHash_key" ON "SupplierOrderRunRecipient"("tokenHash");
CREATE UNIQUE INDEX "SupplierOrderRunRecipient_runId_userId_key" ON "SupplierOrderRunRecipient"("runId", "userId");
CREATE INDEX "SupplierOrderRunRecipient_runId_status_idx" ON "SupplierOrderRunRecipient"("runId", "status");
CREATE INDEX "SupplierOrderRunRecipient_userId_createdAt_idx" ON "SupplierOrderRunRecipient"("userId", "createdAt");
CREATE UNIQUE INDEX "SupplierOrderResponseItem_recipientId_supplierCatalogItemId_key" ON "SupplierOrderResponseItem"("recipientId", "supplierCatalogItemId");
CREATE INDEX "SupplierOrderResponseItem_supplierCatalogItemId_idx" ON "SupplierOrderResponseItem"("supplierCatalogItemId");
CREATE UNIQUE INDEX "SupplierOrderWhatsAppDelivery_dedupeKey_key" ON "SupplierOrderWhatsAppDelivery"("dedupeKey");
CREATE UNIQUE INDEX "SupplierOrderWhatsAppDelivery_metaMessageId_key" ON "SupplierOrderWhatsAppDelivery"("metaMessageId");
CREATE INDEX "SupplierOrderWhatsAppDelivery_runId_type_status_idx" ON "SupplierOrderWhatsAppDelivery"("runId", "type", "status");
CREATE INDEX "SupplierOrderWhatsAppDelivery_recipientId_createdAt_idx" ON "SupplierOrderWhatsAppDelivery"("recipientId", "createdAt");
CREATE INDEX "SupplierOrderWhatsAppDelivery_status_lastAttemptAt_idx" ON "SupplierOrderWhatsAppDelivery"("status", "lastAttemptAt");

ALTER TABLE "SupplierOrderSchedule" ADD CONSTRAINT "SupplierOrderSchedule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderSchedule" ADD CONSTRAINT "SupplierOrderSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderScheduleRecipient" ADD CONSTRAINT "SupplierOrderScheduleRecipient_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "SupplierOrderSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderScheduleRecipient" ADD CONSTRAINT "SupplierOrderScheduleRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderRun" ADD CONSTRAINT "SupplierOrderRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "SupplierOrderSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderRun" ADD CONSTRAINT "SupplierOrderRun_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderRun" ADD CONSTRAINT "SupplierOrderRun_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "SupplierPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderRunRecipient" ADD CONSTRAINT "SupplierOrderRunRecipient_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SupplierOrderRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderRunRecipient" ADD CONSTRAINT "SupplierOrderRunRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderResponseItem" ADD CONSTRAINT "SupplierOrderResponseItem_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SupplierOrderRunRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderResponseItem" ADD CONSTRAINT "SupplierOrderResponseItem_supplierCatalogItemId_fkey" FOREIGN KEY ("supplierCatalogItemId") REFERENCES "SupplierCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderWhatsAppDelivery" ADD CONSTRAINT "SupplierOrderWhatsAppDelivery_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SupplierOrderRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderWhatsAppDelivery" ADD CONSTRAINT "SupplierOrderWhatsAppDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SupplierOrderRunRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
