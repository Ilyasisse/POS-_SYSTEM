CREATE TYPE "SupplierDeliveryStatus" AS ENUM ('PENDING_AI', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');
CREATE TYPE "SupplierPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "googleEmail" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierDelivery" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "uploadedByEmail" TEXT NOT NULL,
    "receiptObjectPath" TEXT NOT NULL,
    "receiptContentType" TEXT NOT NULL,
    "status" "SupplierDeliveryStatus" NOT NULL DEFAULT 'PENDING_AI',
    "invoiceNumber" TEXT,
    "receiptDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "subtotalAmount" DECIMAL(65,30),
    "taxAmount" DECIMAL(65,30),
    "discountAmount" DECIMAL(65,30),
    "totalAmount" DECIMAL(65,30),
    "aiRawResponse" JSONB,
    "aiParsedJson" JSONB,
    "aiError" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "inventoryUpdatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierDeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "productId" TEXT,
    "inventorySupplyId" TEXT,
    "aiItemName" TEXT NOT NULL,
    "matchedItemName" TEXT,
    "quantity" DECIMAL(65,30),
    "verifiedQuantity" INTEGER,
    "unitPrice" DECIMAL(65,30),
    "totalPrice" DECIMAL(65,30),
    "confidenceScore" DOUBLE PRECISION,
    "needsManualReview" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierDeliveryItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierDeliveryItem_single_target_check" CHECK (NOT ("productId" IS NOT NULL AND "inventorySupplyId" IS NOT NULL))
);

CREATE TABLE "SupplierBill" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "SupplierPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "settledAt" TIMESTAMP(3),
    "settledByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierBill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierBill_amounts_check" CHECK ("totalAmount" >= 0 AND "paidAmount" >= 0 AND "paidAmount" <= "totalAmount")
);

CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupplierPayment_positive_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");
CREATE UNIQUE INDEX "Supplier_googleEmail_key" ON "Supplier"("googleEmail");
CREATE INDEX "Supplier_isActive_name_idx" ON "Supplier"("isActive", "name");
CREATE INDEX "SupplierDelivery_supplierId_submittedAt_idx" ON "SupplierDelivery"("supplierId", "submittedAt");
CREATE INDEX "SupplierDelivery_status_submittedAt_idx" ON "SupplierDelivery"("status", "submittedAt");
CREATE INDEX "SupplierDeliveryItem_deliveryId_idx" ON "SupplierDeliveryItem"("deliveryId");
CREATE INDEX "SupplierDeliveryItem_productId_idx" ON "SupplierDeliveryItem"("productId");
CREATE INDEX "SupplierDeliveryItem_inventorySupplyId_idx" ON "SupplierDeliveryItem"("inventorySupplyId");
CREATE UNIQUE INDEX "SupplierBill_deliveryId_key" ON "SupplierBill"("deliveryId");
CREATE INDEX "SupplierBill_supplierId_createdAt_idx" ON "SupplierBill"("supplierId", "createdAt");
CREATE INDEX "SupplierBill_status_createdAt_idx" ON "SupplierBill"("status", "createdAt");
CREATE INDEX "SupplierPayment_billId_paidAt_idx" ON "SupplierPayment"("billId", "paidAt");
CREATE INDEX "SupplierPayment_recordedByUserId_paidAt_idx" ON "SupplierPayment"("recordedByUserId", "paidAt");

ALTER TABLE "SupplierDelivery" ADD CONSTRAINT "SupplierDelivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierDelivery" ADD CONSTRAINT "SupplierDelivery_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierDelivery" ADD CONSTRAINT "SupplierDelivery_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierDeliveryItem" ADD CONSTRAINT "SupplierDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SupplierDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierDeliveryItem" ADD CONSTRAINT "SupplierDeliveryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierDeliveryItem" ADD CONSTRAINT "SupplierDeliveryItem_inventorySupplyId_fkey" FOREIGN KEY ("inventorySupplyId") REFERENCES "InventorySupply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SupplierDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
