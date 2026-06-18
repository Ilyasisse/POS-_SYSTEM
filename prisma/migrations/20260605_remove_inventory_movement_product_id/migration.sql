-- Keep this migration idempotent because the Supabase column may already have
-- been removed manually. Dropping the constraint first avoids PostgreSQL
-- blocking the column drop if any old foreign key metadata is still present.
ALTER TABLE "InventoryMovement"
DROP CONSTRAINT IF EXISTS "InventoryMovement_productId_fkey";

-- Remove the old product movement index if it exists; current movement lookups
-- are supply-based and continue to use "InventoryMovement_supplyId_createdAt_idx".
DROP INDEX IF EXISTS "InventoryMovement_productId_createdAt_idx";

-- Final schema alignment: Prisma must not see or query productId on
-- InventoryMovement, otherwise findMany() will select a missing database column.
ALTER TABLE "InventoryMovement"
DROP COLUMN IF EXISTS "productId";
