CREATE TABLE "CafeSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'Mash Allah Cafe',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "businessDayStartMinute" INTEGER NOT NULL DEFAULT 420,
    "businessDayEndMinute" INTEGER NOT NULL DEFAULT 300,
    "weekStartDay" INTEGER NOT NULL DEFAULT 6,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CafeSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CafeSetting_updatedByUserId_idx" ON "CafeSetting"("updatedByUserId");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_relatedEntityType_relatedEntityId_idx" ON "AuditLog"("relatedEntityType", "relatedEntityId");

ALTER TABLE "CafeSetting" ADD CONSTRAINT "CafeSetting_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CafeSetting" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
