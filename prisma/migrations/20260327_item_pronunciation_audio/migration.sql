ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "pronunciationAudioUrl" TEXT;

ALTER TABLE "Modifier"
ADD COLUMN IF NOT EXISTS "pronunciationAudioUrl" TEXT;
