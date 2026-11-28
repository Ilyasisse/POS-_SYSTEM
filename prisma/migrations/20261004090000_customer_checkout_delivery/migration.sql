ALTER TABLE "CustomerCheckout"
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "deliveryPhone" TEXT;

ALTER TABLE "CustomerCheckout"
ADD CONSTRAINT "CustomerCheckout_delivery_details_check"
CHECK (
  "orderType" <> 'DELIVERY'
  OR (
    "tableId" IS NULL
    AND "deliveryAddress" IS NOT NULL
    AND length(trim("deliveryAddress")) BETWEEN 5 AND 500
    AND "deliveryPhone" IS NOT NULL
    AND length(trim("deliveryPhone")) BETWEEN 5 AND 30
    AND trim("deliveryPhone") ~ '^[+]?[0-9[:space:]()-]+$'
    AND length(regexp_replace("deliveryPhone", '[^0-9]', '', 'g')) >= 5
  )
) NOT VALID;
