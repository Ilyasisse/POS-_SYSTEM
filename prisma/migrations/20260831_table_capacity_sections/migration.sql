ALTER TABLE "Table"
ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN "section" VARCHAR(80) NOT NULL DEFAULT 'Main Floor';

ALTER TABLE "Table"
ADD CONSTRAINT "Table_capacity_check" CHECK ("capacity" BETWEEN 1 AND 50);

CREATE INDEX "Table_section_isActive_idx" ON "Table"("section", "isActive");
