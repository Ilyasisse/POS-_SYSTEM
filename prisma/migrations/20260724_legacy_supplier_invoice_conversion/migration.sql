-- Preserve non-OCR legacy invoice metadata before removing the delivery workflow.
ALTER TABLE "SupplierInvoice"
ADD COLUMN "legacyDeliveryDate" TIMESTAMP(3),
ADD COLUMN "legacySubtotalAmount" DECIMAL(14,2),
ADD COLUMN "legacyTaxAmount" DECIMAL(14,2),
ADD COLUMN "legacyDiscountAmount" DECIMAL(14,2);

CREATE TEMP TABLE "_LegacySupplierInvoiceAudit" ON COMMIT DROP AS
SELECT
  (SELECT COUNT(*) FROM "SupplierDelivery")::BIGINT AS "deliveryCount",
  (SELECT COUNT(*) FROM "SupplierDeliveryItem")::BIGINT AS "itemCount",
  (SELECT COUNT(*) FROM "SupplierBill" WHERE "deliveryId" IS NOT NULL)::BIGINT AS "billCount",
  (SELECT COUNT(*) FROM "SupplierPayment")::BIGINT AS "paymentCount";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SupplierDelivery"
    WHERE "status"::text NOT IN (
      'PENDING_EXTRACTION',
      'PENDING_VERIFICATION',
      'VERIFIED',
      'REJECTED'
    )
  ) THEN
    RAISE EXCEPTION 'Legacy supplier conversion found an unsupported delivery status.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SupplierDelivery" delivery
    JOIN "SupplierInvoice" invoice ON invoice."id" = delivery."id"
  ) THEN
    RAISE EXCEPTION 'Legacy supplier conversion found an invoice ID collision.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SupplierDelivery" delivery
    WHERE
      (delivery."invoiceNumber" IS NOT NULL AND char_length(btrim(delivery."invoiceNumber")) > 200)
      OR (delivery."notes" IS NOT NULL AND char_length(delivery."notes") > 2000)
      OR COALESCE(
        delivery."totalAmount",
        (SELECT SUM(item."totalPrice") FROM "SupplierDeliveryItem" item WHERE item."deliveryId" = delivery."id"),
        0
      ) < 0
      OR COALESCE(
        delivery."totalAmount",
        (SELECT SUM(item."totalPrice") FROM "SupplierDeliveryItem" item WHERE item."deliveryId" = delivery."id"),
        0
      ) > 999999999999.99
  ) THEN
    RAISE EXCEPTION 'Legacy supplier conversion found invoice metadata outside supported limits.';
  END IF;
END $$;

INSERT INTO "SupplierInvoice" (
  "id",
  "supplierId",
  "purchaseOrderId",
  "source",
  "status",
  "invoiceNumber",
  "invoiceDate",
  "dueDate",
  "notes",
  "totalAmount",
  "receiptObjectPath",
  "receiptContentType",
  "uploadedByEmail",
  "submittedAt",
  "legacyDeliveryDate",
  "legacySubtotalAmount",
  "legacyTaxAmount",
  "legacyDiscountAmount",
  "legacyInventoryUpdatedAt",
  "createdByUserId",
  "finalizedAt",
  "finalizedByUserId",
  "voidedAt",
  "voidedByUserId",
  "voidReason",
  "createdAt",
  "updatedAt"
)
SELECT
  delivery."id",
  delivery."supplierId",
  NULL,
  'LEGACY_UPLOAD'::"SupplierInvoiceSource",
  CASE delivery."status"::text
    WHEN 'VERIFIED' THEN 'FINALIZED'::"SupplierInvoiceStatus"
    WHEN 'REJECTED' THEN 'VOID'::"SupplierInvoiceStatus"
    ELSE 'DRAFT'::"SupplierInvoiceStatus"
  END,
  NULLIF(btrim(delivery."invoiceNumber"), ''),
  COALESCE(
    delivery."receiptDate"::date,
    delivery."deliveryDate"::date,
    delivery."submittedAt"::date
  ),
  COALESCE(
    bill."dueDate",
    COALESCE(
      delivery."receiptDate"::date,
      delivery."deliveryDate"::date,
      delivery."submittedAt"::date
    ) + 1
  ),
  delivery."notes",
  COALESCE(
    bill."totalAmount",
    delivery."totalAmount",
    item_totals."totalAmount",
    0
  ),
  delivery."receiptObjectPath",
  delivery."receiptContentType",
  delivery."uploadedByEmail",
  delivery."submittedAt",
  delivery."deliveryDate",
  delivery."subtotalAmount",
  delivery."taxAmount",
  delivery."discountAmount",
  delivery."inventoryUpdatedAt",
  NULL,
  CASE WHEN delivery."status"::text = 'VERIFIED' THEN delivery."verifiedAt" END,
  CASE WHEN delivery."status"::text = 'VERIFIED' THEN delivery."verifiedByUserId" END,
  CASE WHEN delivery."status"::text = 'REJECTED' THEN delivery."rejectedAt" END,
  CASE WHEN delivery."status"::text = 'REJECTED' THEN delivery."rejectedByUserId" END,
  CASE WHEN delivery."status"::text = 'REJECTED' THEN delivery."rejectionReason" END,
  delivery."createdAt",
  delivery."updatedAt"
FROM "SupplierDelivery" delivery
LEFT JOIN "SupplierBill" bill ON bill."deliveryId" = delivery."id"
LEFT JOIN LATERAL (
  SELECT SUM(item."totalPrice") AS "totalAmount"
  FROM "SupplierDeliveryItem" item
  WHERE item."deliveryId" = delivery."id"
) item_totals ON true;

DO $$
BEGIN
  IF EXISTS (
    WITH normalized AS (
      SELECT
        item."id",
        COALESCE(
          CASE WHEN item."quantity" > 0 THEN item."quantity" END,
          CASE WHEN item."verifiedQuantity" > 0 THEN item."verifiedQuantity"::numeric END,
          CASE
            WHEN item."unitPrice" > 0 AND item."totalPrice" >= 0
            THEN item."totalPrice" / item."unitPrice"
          END,
          1
        ) AS quantity,
        COALESCE(
          CASE WHEN item."unitPrice" >= 0 THEN item."unitPrice" END,
          0
        ) AS "unitPrice",
        COALESCE(
          CASE WHEN item."totalPrice" >= 0 THEN item."totalPrice" END,
          0
        ) AS "lineTotal",
        COALESCE(NULLIF(btrim(item."matchedItemName"), ''), NULLIF(btrim(item."aiItemName"), '')) AS "itemName",
        item."notes"
      FROM "SupplierDeliveryItem" item
    )
    SELECT 1
    FROM normalized
    WHERE
      "itemName" IS NULL
      OR char_length("itemName") > 300
      OR quantity <= 0
      OR quantity > 999999999.999
      OR "unitPrice" < 0
      OR "unitPrice" > 9999999999.99
      OR "lineTotal" < 0
      OR "lineTotal" > 999999999999.99
      OR ("notes" IS NOT NULL AND char_length("notes") > 1000)
  ) THEN
    RAISE EXCEPTION 'Legacy supplier conversion found line data outside supported limits.';
  END IF;
END $$;

WITH normalized AS (
  SELECT
    item."id",
    item."deliveryId",
    COALESCE(
      NULLIF(btrim(item."matchedItemName"), ''),
      NULLIF(btrim(item."aiItemName"), '')
    ) AS "itemName",
    COALESCE(
      CASE WHEN item."quantity" > 0 THEN item."quantity" END,
      CASE WHEN item."verifiedQuantity" > 0 THEN item."verifiedQuantity"::numeric END,
      CASE
        WHEN item."unitPrice" > 0 AND item."totalPrice" >= 0
        THEN item."totalPrice" / item."unitPrice"
      END,
      1
    )::DECIMAL(12,3) AS quantity,
    COALESCE(
      CASE WHEN item."unitPrice" >= 0 THEN item."unitPrice" END,
      0
    )::DECIMAL(12,2) AS "unitPrice",
    item."totalPrice",
    item."notes",
    item."createdAt",
    item."updatedAt",
    catalog."id" AS "candidateCatalogItemId",
    COALESCE(catalog."unit", 'unit') AS "itemUnit"
  FROM "SupplierDeliveryItem" item
  JOIN "SupplierDelivery" delivery ON delivery."id" = item."deliveryId"
  LEFT JOIN LATERAL (
    SELECT catalog_item."id", catalog_item."unit"
    FROM "SupplierCatalogItem" catalog_item
    WHERE
      catalog_item."supplierId" = delivery."supplierId"
      AND (
        (item."productId" IS NOT NULL AND catalog_item."productId" = item."productId")
        OR (
          item."inventorySupplyId" IS NOT NULL
          AND catalog_item."inventorySupplyId" = item."inventorySupplyId"
        )
      )
    ORDER BY catalog_item."createdAt" ASC, catalog_item."id" ASC
    LIMIT 1
  ) catalog ON true
), ranked AS (
  SELECT
    normalized.*,
    ROW_NUMBER() OVER (
      PARTITION BY "deliveryId", "candidateCatalogItemId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS "catalogRank"
  FROM normalized
)
INSERT INTO "SupplierInvoiceItem" (
  "id",
  "invoiceId",
  "supplierCatalogItemId",
  "itemName",
  "itemUnit",
  "quantity",
  "unitPrice",
  "lineTotal",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  ranked."id",
  ranked."deliveryId",
  CASE
    WHEN ranked."candidateCatalogItemId" IS NOT NULL AND ranked."catalogRank" = 1
    THEN ranked."candidateCatalogItemId"
    ELSE NULL
  END,
  ranked."itemName",
  ranked."itemUnit",
  ranked.quantity,
  ranked."unitPrice",
  COALESCE(
    CASE WHEN ranked."totalPrice" >= 0 THEN ranked."totalPrice" END,
    ROUND(ranked.quantity * ranked."unitPrice", 2)
  )::DECIMAL(14,2),
  ranked."notes",
  ranked."createdAt",
  ranked."updatedAt"
FROM ranked;

DO $$
DECLARE
  expected_deliveries BIGINT;
  expected_items BIGINT;
BEGIN
  SELECT "deliveryCount", "itemCount"
  INTO expected_deliveries, expected_items
  FROM "_LegacySupplierInvoiceAudit";

  IF (
    SELECT COUNT(*)
    FROM "SupplierInvoice"
    WHERE "source" = 'LEGACY_UPLOAD'
      AND "id" IN (SELECT "id" FROM "SupplierDelivery")
  ) <> expected_deliveries THEN
    RAISE EXCEPTION 'Legacy supplier conversion did not create every invoice.';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM "SupplierInvoiceItem"
    WHERE "invoiceId" IN (SELECT "id" FROM "SupplierDelivery")
  ) <> expected_items THEN
    RAISE EXCEPTION 'Legacy supplier conversion did not create every invoice line.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SupplierDelivery" delivery
    JOIN "SupplierInvoice" invoice ON invoice."id" = delivery."id"
    WHERE
      invoice."supplierId" IS DISTINCT FROM delivery."supplierId"
      OR invoice."receiptObjectPath" IS DISTINCT FROM delivery."receiptObjectPath"
      OR invoice."receiptContentType" IS DISTINCT FROM delivery."receiptContentType"
      OR invoice."uploadedByEmail" IS DISTINCT FROM delivery."uploadedByEmail"
      OR invoice."submittedAt" IS DISTINCT FROM delivery."submittedAt"
      OR invoice."legacyDeliveryDate" IS DISTINCT FROM delivery."deliveryDate"
      OR invoice."legacyInventoryUpdatedAt" IS DISTINCT FROM delivery."inventoryUpdatedAt"
      OR invoice."createdAt" IS DISTINCT FROM delivery."createdAt"
      OR invoice."updatedAt" IS DISTINCT FROM delivery."updatedAt"
      OR invoice."status"::text IS DISTINCT FROM CASE delivery."status"::text
        WHEN 'VERIFIED' THEN 'FINALIZED'
        WHEN 'REJECTED' THEN 'VOID'
        ELSE 'DRAFT'
      END
  ) THEN
    RAISE EXCEPTION 'Legacy supplier conversion audit fields do not match their source records.';
  END IF;
END $$;

-- Move bills in place so payment IDs and their bill foreign keys remain unchanged.
ALTER TABLE "SupplierBill"
DROP CONSTRAINT "SupplierBill_exactly_one_source_check";

UPDATE "SupplierBill"
SET
  "invoiceId" = "deliveryId",
  "deliveryId" = NULL
WHERE "deliveryId" IS NOT NULL;

DO $$
DECLARE
  expected_bills BIGINT;
  expected_payments BIGINT;
BEGIN
  SELECT "billCount", "paymentCount"
  INTO expected_bills, expected_payments
  FROM "_LegacySupplierInvoiceAudit";

  IF (
    SELECT COUNT(*)
    FROM "SupplierBill" bill
    JOIN "SupplierInvoice" invoice ON invoice."id" = bill."invoiceId"
    WHERE invoice."source" = 'LEGACY_UPLOAD'
  ) <> expected_bills THEN
    RAISE EXCEPTION 'Legacy supplier conversion did not move every supplier bill.';
  END IF;

  IF (SELECT COUNT(*) FROM "SupplierPayment") <> expected_payments THEN
    RAISE EXCEPTION 'Legacy supplier conversion changed supplier payment history.';
  END IF;

  IF EXISTS (SELECT 1 FROM "SupplierBill" WHERE "invoiceId" IS NULL) THEN
    RAISE EXCEPTION 'Supplier bill conversion left a bill without an invoice.';
  END IF;
END $$;

ALTER TABLE "SupplierBill"
DROP CONSTRAINT "SupplierBill_deliveryId_fkey",
DROP COLUMN "deliveryId",
ALTER COLUMN "invoiceId" SET NOT NULL;

DROP TABLE "SupplierDeliveryItem";
DROP TABLE "SupplierDelivery";
DROP TYPE "SupplierDeliveryStatus";

ALTER TABLE "Supplier"
DROP COLUMN "googleEmail";
