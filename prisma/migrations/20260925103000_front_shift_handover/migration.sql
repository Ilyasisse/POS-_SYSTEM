CREATE TABLE "ShiftHandoverNote" (
  "id" TEXT NOT NULL,
  "requestToken" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  CONSTRAINT "ShiftHandoverNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShiftHandoverNote_title_check" CHECK (char_length(btrim("title")) BETWEEN 5 AND 120),
  CONSTRAINT "ShiftHandoverNote_details_check" CHECK (char_length(btrim("details")) BETWEEN 10 AND 1000),
  CONSTRAINT "ShiftHandoverNote_resolution_check" CHECK (
    ("resolvedAt" IS NULL AND "resolvedByUserId" IS NULL AND "resolutionNote" IS NULL)
    OR ("resolvedAt" IS NOT NULL AND "resolvedByUserId" IS NOT NULL AND "resolutionNote" IS NOT NULL AND char_length(btrim("resolutionNote")) BETWEEN 3 AND 1000)
  )
);

CREATE UNIQUE INDEX "ShiftHandoverNote_requestToken_key" ON "ShiftHandoverNote"("requestToken");
CREATE INDEX "ShiftHandoverNote_resolvedAt_createdAt_idx" ON "ShiftHandoverNote"("resolvedAt", "createdAt");
CREATE INDEX "ShiftHandoverNote_createdByUserId_createdAt_idx" ON "ShiftHandoverNote"("createdByUserId", "createdAt");
ALTER TABLE "ShiftHandoverNote" ADD CONSTRAINT "ShiftHandoverNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandoverNote" ADD CONSTRAINT "ShiftHandoverNote_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permission-checked server routes use a privileged database connection.
ALTER TABLE "ShiftHandoverNote" ENABLE ROW LEVEL SECURITY;
