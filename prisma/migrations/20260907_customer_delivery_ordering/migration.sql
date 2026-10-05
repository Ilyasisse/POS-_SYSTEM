ALTER TABLE "Order"
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "deliveryPhone" TEXT;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_delivery_details_check"
CHECK (
  "type" <> 'DELIVERY'
  OR (
    "deliveryAddress" IS NOT NULL
    AND length(trim("deliveryAddress")) >= 5
    AND "deliveryPhone" IS NOT NULL
    AND length(trim("deliveryPhone")) >= 5
  )
) NOT VALID;
