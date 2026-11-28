ALTER TABLE "Table" ADD COLUMN "floorX" INTEGER;
ALTER TABLE "Table" ADD COLUMN "floorY" INTEGER;

ALTER TABLE "Table" ADD CONSTRAINT "Table_floor_position_complete"
  CHECK (("floorX" IS NULL AND "floorY" IS NULL) OR
         ("floorX" IS NOT NULL AND "floorY" IS NOT NULL AND
          "floorX" BETWEEN 5 AND 95 AND "floorY" BETWEEN 5 AND 95));
