-- Each confirmed package or service unit is counted as one stock unit.
-- Keep the recorded balances and immutable movements in their original units.
WITH mapped AS (
  UPDATE "InventorySupply" AS supply
  SET "canonicalUnit" = 'PIECE',
      "quantityCoverage" = 'COMPLETE',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE supply."isActive"
    AND supply."canonicalUnit" IS NULL
    AND supply."quantityCoverage" = 'LEGACY_INCOMPLETE'
    AND lower(btrim(supply.unit)) IN ('box', 'haan', 'barrel', 'bottle', '4liters', 'kiish', 'travel')
    AND supply."standardUnitCost" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "StockEvent" WHERE "supplyId" = supply.id)
    AND NOT EXISTS (SELECT 1 FROM "RecipeIngredient" WHERE "supplyId" = supply.id)
    AND NOT EXISTS (SELECT 1 FROM "InventoryCountLine" WHERE "supplyId" = supply.id)
    AND NOT EXISTS (SELECT 1 FROM "InventoryUnitConversion" WHERE "supplyId" = supply.id)
  RETURNING supply.id, supply.unit, supply."stockQty", supply."lowStockThreshold"
)
INSERT INTO "AuditLog" (
  id, action, "entityType", "entityId", reason, "previousValue", "newValue"
)
SELECT
  'inventory-counted-unit-' || id,
  'inventory.legacy_unit.mapped',
  'InventorySupply',
  id,
  'Confirmed that one recorded unit is one stock unit',
  jsonb_build_object(
    'unit', unit, 'stockQty', "stockQty"::text, 'lowStockThreshold', "lowStockThreshold"::text,
    'canonicalUnit', NULL::text, 'coverage', 'LEGACY_INCOMPLETE'
  ),
  jsonb_build_object(
    'unit', unit, 'stockQty', "stockQty"::text, 'lowStockThreshold', "lowStockThreshold"::text,
    'canonicalUnit', 'PIECE', 'factor', '1', 'coverage', 'COMPLETE'
  )
FROM mapped;
