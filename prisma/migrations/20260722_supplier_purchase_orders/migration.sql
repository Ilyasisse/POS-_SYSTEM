CREATE TYPE "SupplierPurchaseOrderStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

ALTER TABLE "SupplierBill"
ADD COLUMN "dueDate" DATE;

UPDATE "SupplierBill"
SET "dueDate" = (("createdAt" + INTERVAL '3 hours')::date + 1)
WHERE "dueDate" IS NULL;

ALTER TABLE "SupplierBill"
ALTER COLUMN "dueDate" SET NOT NULL,
ALTER COLUMN "dueDate" SET DEFAULT (CURRENT_DATE + 1);

CREATE INDEX "SupplierBill_status_dueDate_idx"
ON "SupplierBill"("status", "dueDate");

CREATE TABLE "SupplierCatalogItem" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "inventorySupplyId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCatalogItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierCatalogItem_exactly_one_target_check"
      CHECK (("productId" IS NOT NULL)::int + ("inventorySupplyId" IS NOT NULL)::int = 1),
    CONSTRAINT "SupplierCatalogItem_unit_check"
      CHECK (char_length(btrim("unit")) BETWEEN 1 AND 40),
    CONSTRAINT "SupplierCatalogItem_unitPrice_check"
      CHECK ("unitPrice" >= 0)
);

CREATE TABLE "SupplierPurchaseOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" SERIAL NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "SupplierPurchaseOrderStatus" NOT NULL DEFAULT 'OPEN',
    "expectedDeliveryDate" DATE NOT NULL,
    "notes" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPurchaseOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierPurchaseOrder_totalAmount_check" CHECK ("totalAmount" >= 0)
);

CREATE TABLE "SupplierPurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierCatalogItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemUnit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPurchaseOrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierPurchaseOrderItem_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "SupplierPurchaseOrderItem_unitPrice_check" CHECK ("unitPrice" >= 0),
    CONSTRAINT "SupplierPurchaseOrderItem_lineTotal_check" CHECK ("lineTotal" >= 0)
);

CREATE UNIQUE INDEX "SupplierCatalogItem_supplierId_productId_key"
ON "SupplierCatalogItem"("supplierId", "productId");

CREATE UNIQUE INDEX "SupplierCatalogItem_supplierId_inventorySupplyId_key"
ON "SupplierCatalogItem"("supplierId", "inventorySupplyId");

CREATE INDEX "SupplierCatalogItem_supplierId_isActive_idx"
ON "SupplierCatalogItem"("supplierId", "isActive");

CREATE INDEX "SupplierCatalogItem_productId_idx"
ON "SupplierCatalogItem"("productId");

CREATE INDEX "SupplierCatalogItem_inventorySupplyId_idx"
ON "SupplierCatalogItem"("inventorySupplyId");

CREATE UNIQUE INDEX "SupplierPurchaseOrder_orderNumber_key"
ON "SupplierPurchaseOrder"("orderNumber");

CREATE INDEX "SupplierPurchaseOrder_supplierId_status_expectedDeliveryDate_idx"
ON "SupplierPurchaseOrder"("supplierId", "status", "expectedDeliveryDate");

CREATE INDEX "SupplierPurchaseOrder_status_expectedDeliveryDate_idx"
ON "SupplierPurchaseOrder"("status", "expectedDeliveryDate");

CREATE INDEX "SupplierPurchaseOrder_createdByUserId_createdAt_idx"
ON "SupplierPurchaseOrder"("createdByUserId", "createdAt");

CREATE UNIQUE INDEX "SupplierPurchaseOrderItem_purchaseOrderId_supplierCatalogItemId_key"
ON "SupplierPurchaseOrderItem"("purchaseOrderId", "supplierCatalogItemId");

CREATE INDEX "SupplierPurchaseOrderItem_supplierCatalogItemId_idx"
ON "SupplierPurchaseOrderItem"("supplierCatalogItemId");

ALTER TABLE "SupplierCatalogItem"
ADD CONSTRAINT "SupplierCatalogItem_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierCatalogItem"
ADD CONSTRAINT "SupplierCatalogItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierCatalogItem"
ADD CONSTRAINT "SupplierCatalogItem_inventorySupplyId_fkey"
FOREIGN KEY ("inventorySupplyId") REFERENCES "InventorySupply"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPurchaseOrder"
ADD CONSTRAINT "SupplierPurchaseOrder_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPurchaseOrder"
ADD CONSTRAINT "SupplierPurchaseOrder_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPurchaseOrderItem"
ADD CONSTRAINT "SupplierPurchaseOrderItem_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "SupplierPurchaseOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPurchaseOrderItem"
ADD CONSTRAINT "SupplierPurchaseOrderItem_supplierCatalogItemId_fkey"
FOREIGN KEY ("supplierCatalogItemId") REFERENCES "SupplierCatalogItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
