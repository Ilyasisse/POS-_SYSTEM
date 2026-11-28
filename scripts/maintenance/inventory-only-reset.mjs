/** Offline inventory-only maintenance preparation. Never connects to a database. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
export const financialTables = [
  "Supplier",
  "SupplierInvoice",
  "SupplierInvoiceItem",
  "SupplierBill",
  "SupplierInvoiceInstallment",
  "SupplierPayment",
  "SupplierPaymentAllocation",
  "SupplierPurchaseOrder",
  "SupplierPurchaseOrderItem",
  "SupplierReceiving",
  "SupplierReceivingItem",
  "SupplierInvoiceRecurrence",
  "SupplierInvoiceRecurrenceItem",
  "SupplierOrderSchedule",
  "SupplierOrderRun",
  "SupplierOrderRunRecipient",
  "SupplierOrderResponseItem",
  "SupplierOrderWhatsAppDelivery",
  "DailyCashDay",
  "DailyCashSupplierPayment",
  "DailyCashSupplyPayment",
  "DailyCashManualExpense",
  "DailyCashSavingsDeposit",
  "DailySalaryRate",
  "SupplyDay",
  "SupplyPurchase",
  "SupplyCatalogItem",
  "Product",
  "Order",
  "OrderItem",
  "Payment",
  "Staff",
  "Shift",
  "StockEvent",
  "RecipeIngredient",
  "InventoryCountLine",
  "AuditLog",
];
const mutations = [
  "InventorySupply",
  "InventoryMovement",
  "InventoryUnitConversion",
  "SupplierCatalogItem",
];
const hash = (table, predicate = "true", row = "to_jsonb(t)") =>
  `(SELECT md5(coalesce(string_agg(md5((${row})::text),'' ORDER BY t.id),'')) FROM public."${table}" t WHERE ${predicate})`;
const schemaHash =
  () => `(SELECT md5(coalesce(string_agg(definition,'|' ORDER BY definition),'')) FROM (
  SELECT pg_get_constraintdef(c.oid)||c.conrelid::text||c.confrelid::text AS definition FROM pg_constraint c
  WHERE c.confrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('InventorySupply','InventoryMovement','InventoryUnitConversion','SupplierCatalogItem'))
    OR c.conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('InventorySupply','InventoryMovement','InventoryUnitConversion','SupplierCatalogItem'))
  UNION ALL SELECT pg_get_triggerdef(t.oid)||t.tgenabled::text||pg_get_functiondef(t.tgfoid) FROM pg_trigger t
  WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('InventorySupply','InventoryMovement','InventoryUnitConversion','SupplierCatalogItem','StockEvent'))
) x)`;

export function selection(cafeteria) {
  return `WITH all_items AS (SELECT id FROM public."InventorySupply" WHERE "cafeteriaId"=${quote(cafeteria)}),
  eligible AS (SELECT s.id FROM all_items s
    WHERE NOT EXISTS(SELECT 1 FROM public."StockEvent" e WHERE e."supplyId"=s.id)
      AND NOT EXISTS(SELECT 1 FROM public."RecipeIngredient" r WHERE r."supplyId"=s.id)
      AND NOT EXISTS(SELECT 1 FROM public."InventoryCountLine" c WHERE c."supplyId"=s.id)),
  targets(table_name,id) AS (
    SELECT 'InventorySupply',id FROM eligible
    UNION ALL SELECT 'InventoryMovement',id FROM public."InventoryMovement" WHERE "cafeteriaId"=${quote(cafeteria)} AND "itemType"='Supply'
    UNION ALL SELECT 'InventoryUnitConversion',id FROM public."InventoryUnitConversion" WHERE "supplyId" IN (SELECT id FROM eligible)
    UNION ALL SELECT 'SupplierCatalogItem',id FROM public."SupplierCatalogItem" WHERE "inventorySupplyId" IN (SELECT id FROM eligible)
  )`;
}

export function manifestQuery(cafeteria) {
  return `${selection(cafeteria)} SELECT jsonb_build_object(
    'cafeteria',${quote(cafeteria)},'schemaHash',${schemaHash()},
    'targets',(SELECT jsonb_object_agg(table_name,ids) FROM (SELECT table_name,jsonb_agg(id ORDER BY id) ids FROM targets GROUP BY table_name) x),
    'counts',(SELECT jsonb_object_agg(table_name,n) FROM (SELECT table_name,count(*) n FROM targets GROUP BY table_name) x),
    'catalogMustHaveTarget',EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public."SupplierCatalogItem"'::regclass AND conname='SupplierCatalogItem_exactly_one_target_check'),
    'keptItems',(SELECT count(*) FROM all_items WHERE id NOT IN (SELECT id FROM eligible)),
    'protectedHashes',jsonb_build_object(${financialTables.map((t) => `${quote(t)},${hash(t)}`).join(",")}),
    'inputHashes',jsonb_build_object(${mutations.map((t) => `${quote(t)},${hash(t)}`).join(",")}),
    'survivorHashes',jsonb_build_object(${mutations
      .filter((t) => t !== "SupplierCatalogItem")
      .map(
        (t) =>
          `${quote(t)},${hash(t, `t.id NOT IN (SELECT id FROM targets WHERE table_name=${quote(t)})`)}`,
      )
      .join(",")}),
    'expectedCatalogHash',${hash("SupplierCatalogItem", "true", `CASE WHEN t.id IN (SELECT id FROM targets WHERE table_name='SupplierCatalogItem') THEN to_jsonb(t)||jsonb_build_object('inventorySupplyId',NULL) ELSE to_jsonb(t) END`)},
    'crossCafeteria',(${mutations.map((t) => `(SELECT count(*) FROM public."${t}" WHERE id IN (SELECT id FROM targets WHERE table_name=${quote(t)}) AND "cafeteriaId"<>${quote(cafeteria)})`).join("+")})
  ) AS manifest;`;
}

export function executionSql(manifest) {
  if (manifest.crossCafeteria !== 0) throw new Error("Cross-cafeteria dependency; stop for review");
  if (!manifest.targets?.InventorySupply?.length)
    throw new Error("No eligible items in the manifest");
  if (manifest.catalogMustHaveTarget && manifest.targets?.SupplierCatalogItem?.length)
    throw new Error(
      "Supplier catalog entries require their current inventory targets. Revise the cleanup scope before execution.",
    );
  const allowed = new Set(mutations);
  if (Object.keys(manifest.targets).some((t) => !allowed.has(t)))
    throw new Error("Unsupported mutation table");
  const ids = (t) => (manifest.targets[t] || []).map(quote).join(",") || "NULL";
  const checks = Object.entries({ ...manifest.protectedHashes, ...manifest.inputHashes })
    .map(([t, v]) => {
      if (!financialTables.includes(t) && !allowed.has(t))
        throw new Error("Unsupported fingerprint table");
      return `IF ${hash(t)}<>${quote(v)} THEN RAISE EXCEPTION 'Reviewed data changed: ${t}'; END IF;`;
    })
    .join("\n");
  const preserve = Object.entries(manifest.protectedHashes)
    .map(
      ([t, v]) =>
        `IF ${hash(t)}<>${quote(v)} THEN RAISE EXCEPTION 'Protected records changed: ${t}'; END IF;`,
    )
    .join("\n");
  const survivors = Object.entries(manifest.survivorHashes)
    .map(
      ([t, v]) =>
        `IF ${hash(t)}<>${quote(v)} THEN RAISE EXCEPTION 'Survivors changed: ${t}'; END IF;`,
    )
    .join("\n");
  const deletes = ["InventoryMovement", "InventoryUnitConversion", "InventorySupply"]
    .map(
      (t) => `WITH removed AS (
    DELETE FROM public."${t}" WHERE "cafeteriaId"=${quote(manifest.cafeteria)} AND id IN (${ids(t)}) RETURNING 1
  ) INSERT INTO inventory_only_result VALUES (${quote(t)},(SELECT count(*) FROM removed));`,
    )
    .join("\n");
  return `BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
SELECT set_config('app.cafeteria_id',${quote(manifest.cafeteria)},true);
LOCK TABLE ${mutations.map((t) => `public."${t}"`).join(",")} IN SHARE ROW EXCLUSIVE MODE;
DO $review$ BEGIN
  IF ${schemaHash()}<>${quote(manifest.schemaHash)} THEN RAISE EXCEPTION 'Constraints or triggers changed'; END IF;
  ${checks}
  IF EXISTS(SELECT 1 FROM public."StockEvent" WHERE "supplyId" IN (${ids("InventorySupply")}))
    OR EXISTS(SELECT 1 FROM public."RecipeIngredient" WHERE "supplyId" IN (${ids("InventorySupply")}))
    OR EXISTS(SELECT 1 FROM public."InventoryCountLine" WHERE "supplyId" IN (${ids("InventorySupply")}))
    THEN RAISE EXCEPTION 'An item gained a protected dependency'; END IF;
END $review$;
CREATE TEMP TABLE inventory_only_result(table_name text PRIMARY KEY,n integer) ON COMMIT DROP;
WITH disconnected AS (
  UPDATE public."SupplierCatalogItem" SET "inventorySupplyId"=NULL
  WHERE "cafeteriaId"=${quote(manifest.cafeteria)} AND id IN (${ids("SupplierCatalogItem")}) AND "inventorySupplyId" IN (${ids("InventorySupply")}) RETURNING 1
) INSERT INTO inventory_only_result VALUES ('SupplierCatalogItem',(SELECT count(*) FROM disconnected));
${deletes}
SET CONSTRAINTS ALL IMMEDIATE;
DO $verify$ BEGIN
  ${preserve}
  ${survivors}
  IF ${hash("SupplierCatalogItem")}<>${quote(manifest.expectedCatalogHash)} THEN RAISE EXCEPTION 'Unexpected catalog change'; END IF;
  IF ${schemaHash()}<>${quote(manifest.schemaHash)} THEN RAISE EXCEPTION 'Protections changed'; END IF;
  IF (SELECT count(*) FROM public."InventorySupply" WHERE "cafeteriaId"=${quote(manifest.cafeteria)})<>${manifest.keptItems} THEN RAISE EXCEPTION 'Unexpected remaining items'; END IF;
  ${mutations.map((t) => `IF (SELECT n FROM inventory_only_result WHERE table_name=${quote(t)})<>${(manifest.targets[t] || []).length} THEN RAISE EXCEPTION 'Unexpected affected count: ${t}'; END IF;`).join("\n")}
END $verify$;
SELECT set_config('inventory_only_reset.result',jsonb_build_object('affected',(SELECT jsonb_object_agg(table_name,n) FROM inventory_only_result),'remainingItems',${manifest.keptItems},'financialRecordsUnchanged',true,'ledgerProtectionUnchanged',true)::text,false);
COMMIT;
SELECT current_setting('inventory_only_reset.result')::jsonb AS cleanup_result;`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, input, output] = process.argv.slice(2);
  if (mode === "manifest") process.stdout.write(manifestQuery(input));
  else if (mode === "prepare") {
    const manifest = JSON.parse(readFileSync(input, "utf8"));
    writeFileSync(output, executionSql(manifest));
    process.stdout.write(
      JSON.stringify(
        {
          counts: manifest.counts,
          keptItems: manifest.keptItems,
          crossCafeteria: manifest.crossCafeteria,
        },
        null,
        2,
      ) + "\n",
    );
  } else throw new Error("Use manifest <cafeteria> or prepare <manifest.json> <output.sql>");
}
