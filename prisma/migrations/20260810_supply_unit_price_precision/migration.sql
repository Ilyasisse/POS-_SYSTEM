ALTER TABLE "SupplyCatalogItem"
ALTER COLUMN "defaultUnitPrice" TYPE DECIMAL(14,4);

ALTER TABLE "SupplyPurchase"
ALTER COLUMN "unitPrice" TYPE DECIMAL(14,4);
