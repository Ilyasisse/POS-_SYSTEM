ALTER TABLE "Product"
ADD COLUMN "isOpenPrice" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Product_isOpenPrice_isActive_idx"
ON "Product"("isOpenPrice", "isActive");
