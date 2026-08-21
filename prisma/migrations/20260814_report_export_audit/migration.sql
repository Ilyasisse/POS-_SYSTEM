CREATE TABLE "ReportExportAudit" (
  "id" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "report" TEXT NOT NULL,
  "format" TEXT NOT NULL, "filters" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportExportAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportExportAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReportExportAudit_actorUserId_createdAt_idx" ON "ReportExportAudit"("actorUserId", "createdAt");
