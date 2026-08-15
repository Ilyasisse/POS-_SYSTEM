CREATE TYPE "WhatsAppProvider" AS ENUM ('META', 'TWILIO');

ALTER TABLE "SupplierOrderWhatsAppDelivery"
ADD COLUMN "provider" "WhatsAppProvider";

UPDATE "SupplierOrderWhatsAppDelivery"
SET "provider" = 'META';

ALTER TABLE "SupplierOrderWhatsAppDelivery"
ALTER COLUMN "provider" SET NOT NULL,
ALTER COLUMN "provider" SET DEFAULT 'TWILIO';

ALTER TABLE "SupplierOrderWhatsAppDelivery"
RENAME COLUMN "metaMessageId" TO "providerMessageId";

ALTER TABLE "SupplierOrderWhatsAppDelivery"
RENAME COLUMN "mediaId" TO "providerMediaReference";

ALTER INDEX "SupplierOrderWhatsAppDelivery_metaMessageId_key"
RENAME TO "SupplierOrderWhatsAppDelivery_providerMessageId_key";
