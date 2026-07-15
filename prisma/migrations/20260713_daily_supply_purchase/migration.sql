CREATE TABLE "SupplyPurchase" (
    "id" TEXT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyPurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyPurchase_purchaseDate_idx"
ON "SupplyPurchase"("purchaseDate");

CREATE INDEX "SupplyPurchase_createdByUserId_purchaseDate_idx"
ON "SupplyPurchase"("createdByUserId", "purchaseDate");

ALTER TABLE "SupplyPurchase"
ADD CONSTRAINT "SupplyPurchase_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
