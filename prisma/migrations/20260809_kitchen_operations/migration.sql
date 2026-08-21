CREATE TYPE "KitchenTransitionType" AS ENUM ('STATION_CREATED', 'STATION_STARTED', 'STATION_COMPLETED', 'STATION_REOPENED', 'PICKUP_READY', 'PICKUP_REOPENED', 'PICKUP_CLAIMED', 'PICKUP_DELIVERED');
CREATE TYPE "KitchenQualityEventType" AS ENUM ('LATE', 'REMAKE', 'WRONG_ORDER', 'WAITER_MISTAKE');
CREATE TYPE "OperationalIncidentType" AS ENUM ('EQUIPMENT', 'POS', 'INTERNET');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "CleaningRunStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED');

CREATE TABLE "KitchenPreparationTarget" (
  "id" TEXT NOT NULL, "station" "Station" NOT NULL, "targetMinutes" INTEGER NOT NULL,
  "updatedByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "KitchenPreparationTarget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KitchenPreparationTarget_minutes_positive" CHECK ("targetMinutes" BETWEEN 1 AND 240)
);
CREATE TABLE "KitchenTransitionEvent" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "station" "Station", "type" "KitchenTransitionType" NOT NULL,
  "fromStationStatus" "KitchenStationTicketStatus", "toStationStatus" "KitchenStationTicketStatus",
  "fromPickupStatus" "KitchenPickupStatus", "toPickupStatus" "KitchenPickupStatus", "targetMinutesSnapshot" INTEGER,
  "actorUserId" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "KitchenTransitionEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "KitchenQualityEvent" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "orderItemId" TEXT, "station" "Station",
  "type" "KitchenQualityEventType" NOT NULL, "reason" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KitchenQualityEvent_pkey" PRIMARY KEY ("id"), CONSTRAINT "KitchenQualityEvent_reason_required" CHECK (length(trim("reason")) >= 3)
);
CREATE TABLE "OperationalIncident" (
  "id" TEXT NOT NULL, "type" "OperationalIncidentType" NOT NULL, "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN', "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "station" "Station", "reportedByUserId" TEXT NOT NULL, "assignedToUserId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "resolutionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationalIncident_resolution_consistent" CHECK (("status" = 'OPEN' AND "resolvedAt" IS NULL) OR ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL))
);
CREATE TABLE "CleaningChecklistTemplate" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "station" "Station", "schedule" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CleaningChecklistTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CleaningChecklistTask" (
  "id" TEXT NOT NULL, "templateId" TEXT NOT NULL, "label" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CleaningChecklistTask_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CleaningChecklistRun" (
  "id" TEXT NOT NULL, "templateId" TEXT NOT NULL, "station" "Station", "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "CleaningRunStatus" NOT NULL DEFAULT 'PENDING', "assignedToUserId" TEXT, "completedByUserId" TEXT,
  "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "evidenceNote" TEXT, "evidenceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CleaningChecklistRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CleaningChecklistRun_completion_consistent" CHECK (("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "completedByUserId" IS NOT NULL) OR "status" <> 'COMPLETED')
);
CREATE TABLE "CleaningChecklistRunTask" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "taskId" TEXT NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3), "completedByUserId" TEXT, "evidenceText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CleaningChecklistRunTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CleaningChecklistRunTask_completion_consistent" CHECK (("completed" = true AND "completedAt" IS NOT NULL AND "completedByUserId" IS NOT NULL) OR "completed" = false)
);

CREATE UNIQUE INDEX "KitchenPreparationTarget_station_key" ON "KitchenPreparationTarget"("station");
CREATE INDEX "KitchenPreparationTarget_updatedByUserId_idx" ON "KitchenPreparationTarget"("updatedByUserId");
CREATE INDEX "KitchenTransitionEvent_orderId_station_occurredAt_idx" ON "KitchenTransitionEvent"("orderId", "station", "occurredAt");
CREATE INDEX "KitchenTransitionEvent_type_occurredAt_idx" ON "KitchenTransitionEvent"("type", "occurredAt");
CREATE INDEX "KitchenTransitionEvent_actorUserId_occurredAt_idx" ON "KitchenTransitionEvent"("actorUserId", "occurredAt");
CREATE INDEX "KitchenQualityEvent_orderId_occurredAt_idx" ON "KitchenQualityEvent"("orderId", "occurredAt");
CREATE INDEX "KitchenQualityEvent_type_occurredAt_idx" ON "KitchenQualityEvent"("type", "occurredAt");
CREATE INDEX "KitchenQualityEvent_station_occurredAt_idx" ON "KitchenQualityEvent"("station", "occurredAt");
CREATE INDEX "KitchenQualityEvent_actorUserId_occurredAt_idx" ON "KitchenQualityEvent"("actorUserId", "occurredAt");
CREATE INDEX "OperationalIncident_type_status_startedAt_idx" ON "OperationalIncident"("type", "status", "startedAt");
CREATE INDEX "OperationalIncident_severity_status_idx" ON "OperationalIncident"("severity", "status");
CREATE INDEX "OperationalIncident_assignedToUserId_status_idx" ON "OperationalIncident"("assignedToUserId", "status");
CREATE INDEX "CleaningChecklistTemplate_station_isActive_idx" ON "CleaningChecklistTemplate"("station", "isActive");
CREATE INDEX "CleaningChecklistTask_templateId_sortOrder_idx" ON "CleaningChecklistTask"("templateId", "sortOrder");
CREATE INDEX "CleaningChecklistRun_status_scheduledFor_idx" ON "CleaningChecklistRun"("status", "scheduledFor");
CREATE INDEX "CleaningChecklistRun_assignedToUserId_status_idx" ON "CleaningChecklistRun"("assignedToUserId", "status");
CREATE INDEX "CleaningChecklistRun_station_scheduledFor_idx" ON "CleaningChecklistRun"("station", "scheduledFor");
CREATE INDEX "CleaningChecklistRunTask_completedByUserId_completedAt_idx" ON "CleaningChecklistRunTask"("completedByUserId", "completedAt");
CREATE UNIQUE INDEX "CleaningChecklistRunTask_runId_taskId_key" ON "CleaningChecklistRunTask"("runId", "taskId");

ALTER TABLE "KitchenPreparationTarget" ADD CONSTRAINT "KitchenPreparationTarget_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KitchenTransitionEvent" ADD CONSTRAINT "KitchenTransitionEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "KitchenTicketState"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenTransitionEvent" ADD CONSTRAINT "KitchenTransitionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KitchenQualityEvent" ADD CONSTRAINT "KitchenQualityEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "KitchenTicketState"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenQualityEvent" ADD CONSTRAINT "KitchenQualityEvent_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KitchenQualityEvent" ADD CONSTRAINT "KitchenQualityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CleaningChecklistTask" ADD CONSTRAINT "CleaningChecklistTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CleaningChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CleaningChecklistRun" ADD CONSTRAINT "CleaningChecklistRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CleaningChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningChecklistRun" ADD CONSTRAINT "CleaningChecklistRun_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CleaningChecklistRun" ADD CONSTRAINT "CleaningChecklistRun_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CleaningChecklistRunTask" ADD CONSTRAINT "CleaningChecklistRunTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CleaningChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CleaningChecklistRunTask" ADD CONSTRAINT "CleaningChecklistRunTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CleaningChecklistTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningChecklistRunTask" ADD CONSTRAINT "CleaningChecklistRunTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_kitchen_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Kitchen event records are immutable'; END; $$;
CREATE TRIGGER "KitchenTransitionEvent_immutable" BEFORE UPDATE OR DELETE ON "KitchenTransitionEvent" FOR EACH ROW EXECUTE FUNCTION reject_kitchen_event_mutation();
CREATE TRIGGER "KitchenQualityEvent_immutable" BEFORE UPDATE OR DELETE ON "KitchenQualityEvent" FOR EACH ROW EXECUTE FUNCTION reject_kitchen_event_mutation();
