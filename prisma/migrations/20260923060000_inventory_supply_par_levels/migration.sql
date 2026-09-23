ALTER TABLE "InventorySupply" ADD COLUMN "parLevel" DECIMAL(18,6);

ALTER TABLE "InventorySupply" ADD CONSTRAINT "InventorySupply_parLevel_positive"
  CHECK ("parLevel" IS NULL OR "parLevel" > 0);
