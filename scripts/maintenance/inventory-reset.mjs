/** One-time, reviewed maintenance tooling. Never imported by the application. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
export const deleteOrder = [
  "AuditLog",
  "SupplierOrderResponseItem",
  "SupplierOrderWhatsAppDelivery",
  "SupplierOrderRunRecipient",
  "SupplierOrderRun",
  "SupplierReceivingItem",
  "SupplierReceiving",
  "DailyCashSupplierPayment",
  "SupplierPaymentAllocation",
  "SupplierPayment",
  "SupplierInvoiceInstallment",
  "SupplierBill",
  "SupplierInvoiceRecurrenceItem",
  "SupplierInvoiceRecurrence",
  "SupplierInvoiceItem",
  "SupplierInvoice",
  "SupplierPurchaseOrderItem",
  "SupplierPurchaseOrder",
  "InventoryMovement",
  "StockEvent",
  "InventoryUnitConversion",
  "SupplierCatalogItem",
  "InventorySupply",
];
export const cashTables = [
  "DailyCashDay",
  "DailySalaryRate",
  "DailyCashManualExpense",
  "DailyCashSupplierPayment",
  "DailyCashSupplyPayment",
  "DailyCashSavingsDeposit",
  "SupplyDay",
  "Shift",
  "Staff",
  "SupplierBill",
  "SupplierInvoiceInstallment",
  "SupplierInvoice",
  "SupplierPayment",
  "SupplierPaymentAllocation",
  "Supplier",
];
export const protectedTables = [
  "Supplier",
  "Product",
  "Order",
  "OrderItem",
  "Payment",
  "Staff",
  "Shift",
  "DailySalaryRate",
  "DailyCashManualExpense",
  "DailyCashSupplyPayment",
  "DailyCashSavingsDeposit",
  "SupplyDay",
  "SupplyPurchase",
  "SupplyCatalogItem",
  "SupplierOrderSchedule",
];

export function selection(cafeteria) {
  const cafe = quote(cafeteria);
  return `WITH RECURSIVE supply AS (SELECT id FROM public."InventorySupply" WHERE "cafeteriaId"=${cafe}),
    catalog AS (SELECT id FROM public."SupplierCatalogItem" WHERE "inventorySupplyId" IN (SELECT id FROM supply)),
    edges(a,aid,b,bid) AS (
      SELECT 'Catalog',"supplierCatalogItemId",'Order',"purchaseOrderId" FROM public."SupplierPurchaseOrderItem"
      UNION SELECT 'Catalog',"supplierCatalogItemId",'Invoice',"invoiceId" FROM public."SupplierInvoiceItem" WHERE "supplierCatalogItemId" IS NOT NULL
      UNION SELECT 'Catalog',"supplierCatalogItemId",'Recurrence',"recurrenceId" FROM public."SupplierInvoiceRecurrenceItem"
      UNION SELECT 'Order',"purchaseOrderId",'Invoice',id FROM public."SupplierInvoice" WHERE "purchaseOrderId" IS NOT NULL
      UNION SELECT 'Invoice',"sourceInvoiceId",'Recurrence',id FROM public."SupplierInvoiceRecurrence"
      UNION SELECT 'Recurrence',"recurrenceScheduleId",'Invoice',id FROM public."SupplierInvoice" WHERE "recurrenceScheduleId" IS NOT NULL
    ), nodes(kind,id) AS (
      SELECT 'Catalog',id FROM catalog UNION SELECT e.b,e.bid FROM nodes n JOIN edges e ON e.a=n.kind AND e.aid=n.id
    ), orders AS (SELECT id FROM nodes WHERE kind='Order'), invoices AS (SELECT id FROM nodes WHERE kind='Invoice'),
    recurrences AS (SELECT id FROM nodes WHERE kind='Recurrence'),
    bills AS (SELECT id FROM public."SupplierBill" WHERE "invoiceId" IN (SELECT id FROM invoices)),
    installments AS (SELECT id FROM public."SupplierInvoiceInstallment" WHERE "invoiceId" IN (SELECT id FROM invoices) OR "billId" IN (SELECT id FROM bills)),
    payments AS (SELECT DISTINCT "supplierPaymentId" AS id FROM public."SupplierPaymentAllocation" WHERE "billId" IN (SELECT id FROM bills) OR "installmentId" IN (SELECT id FROM installments)),
    runs AS (SELECT id FROM public."SupplierOrderRun" WHERE "purchaseOrderId" IN (SELECT id FROM orders)),
    recipients AS (SELECT id FROM public."SupplierOrderRunRecipient" WHERE "runId" IN (SELECT id FROM runs)),
    receiving AS (SELECT id FROM public."SupplierReceiving" WHERE "purchaseOrderId" IN (SELECT id FROM orders)),
    order_items AS (SELECT id FROM public."SupplierPurchaseOrderItem" WHERE "purchaseOrderId" IN (SELECT id FROM orders)),
    targets(table_name,id) AS (
      SELECT 'InventorySupply',id FROM supply UNION ALL SELECT 'SupplierCatalogItem',id FROM catalog
      UNION ALL SELECT 'SupplierPurchaseOrder',id FROM orders UNION ALL SELECT 'SupplierInvoice',id FROM invoices
      UNION ALL SELECT 'SupplierInvoiceRecurrence',id FROM recurrences UNION ALL SELECT 'SupplierBill',id FROM bills
      UNION ALL SELECT 'SupplierInvoiceInstallment',id FROM installments UNION ALL SELECT 'SupplierPayment',id FROM payments
      UNION ALL SELECT 'SupplierOrderRun',id FROM runs UNION ALL SELECT 'SupplierOrderRunRecipient',id FROM recipients
      UNION ALL SELECT 'SupplierReceiving',id FROM receiving UNION ALL SELECT 'SupplierPurchaseOrderItem',id FROM order_items
      UNION ALL SELECT 'SupplierReceivingItem',id FROM public."SupplierReceivingItem" WHERE "receivingId" IN (SELECT id FROM receiving) OR "purchaseOrderItemId" IN (SELECT id FROM order_items)
      UNION ALL SELECT 'SupplierInvoiceItem',id FROM public."SupplierInvoiceItem" WHERE "invoiceId" IN (SELECT id FROM invoices)
      UNION ALL SELECT 'SupplierInvoiceRecurrenceItem',id FROM public."SupplierInvoiceRecurrenceItem" WHERE "recurrenceId" IN (SELECT id FROM recurrences)
      UNION ALL SELECT 'SupplierPaymentAllocation',id FROM public."SupplierPaymentAllocation" WHERE "supplierPaymentId" IN (SELECT id FROM payments)
      UNION ALL SELECT 'DailyCashSupplierPayment',id FROM public."DailyCashSupplierPayment" WHERE "supplierPaymentId" IN (SELECT id FROM payments)
      UNION ALL SELECT 'SupplierOrderResponseItem',id FROM public."SupplierOrderResponseItem" WHERE "recipientId" IN (SELECT id FROM recipients) OR "supplierCatalogItemId" IN (SELECT id FROM catalog)
      UNION ALL SELECT 'SupplierOrderWhatsAppDelivery',id FROM public."SupplierOrderWhatsAppDelivery" WHERE "runId" IN (SELECT id FROM runs)
      UNION ALL SELECT 'InventoryMovement',id FROM public."InventoryMovement" WHERE "cafeteriaId"=${cafe} AND "itemType"='Supply'
      UNION ALL SELECT 'StockEvent',id FROM public."StockEvent" WHERE "supplyId" IN (SELECT id FROM supply)
      UNION ALL SELECT 'InventoryUnitConversion',id FROM public."InventoryUnitConversion" WHERE "supplyId" IN (SELECT id FROM supply)
    ), all_targets AS (
      SELECT * FROM targets UNION ALL SELECT 'AuditLog',a.id FROM public."AuditLog" a
        WHERE a."cafeteriaId"=${cafe} AND EXISTS (SELECT 1 FROM targets t WHERE t.table_name=a."entityType" AND t.id=a."entityId")
    )`;
}

function tableDigest(table, cafeteria, predicate = "true") {
  return `(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id),'')) FROM public."${table}" t WHERE t."cafeteriaId"=${quote(cafeteria)} AND (${predicate}))`;
}

function survivorDigest(table, idsExpression) {
  return `(SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id),'')) FROM public."${table}" t WHERE t.id NOT IN (${idsExpression}))`;
}
function schemaDigest() {
  const tables = deleteOrder.map(quote).join(",");
  return `(SELECT md5(coalesce(string_agg(definition,'|' ORDER BY definition),'')) FROM (
    SELECT pg_get_constraintdef(c.oid)||c.conrelid::text||c.confrelid::text AS definition FROM pg_constraint c
      WHERE c.conrelid IN (SELECT oid FROM pg_class WHERE relname IN (${tables}) AND relnamespace='public'::regnamespace)
         OR c.confrelid IN (SELECT oid FROM pg_class WHERE relname IN (${tables}) AND relnamespace='public'::regnamespace)
    UNION ALL SELECT pg_get_triggerdef(t.oid)||t.tgenabled::text||pg_get_functiondef(t.tgfoid) FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT oid FROM pg_class WHERE relname IN (${tables}) AND relnamespace='public'::regnamespace)
  ) x)`;
}
function cashFieldsDigest(cafeteria) {
  return `(SELECT md5(coalesce(string_agg(md5((to_jsonb(d)-ARRAY['finalizationFingerprint','finalizedRevenue','finalizedPaidExpenses','finalizedUnpaidRequired','finalizedRemainingCash','finalizedSavingsUsed','finalizedAdditionalSavingsRequired','updatedAt'])::text),'' ORDER BY d.id),'')) FROM public."DailyCashDay" d WHERE d."cafeteriaId"=${quote(cafeteria)})`;
}

export function manifestQuery(cafeteria) {
  const cafe = quote(cafeteria);
  return `${selection(cafeteria)} SELECT jsonb_build_object(
    'cafeteria',${cafe},
    'targets',(SELECT coalesce(jsonb_object_agg(table_name,ids),'{}'::jsonb) FROM (SELECT table_name,jsonb_agg(id ORDER BY id) ids FROM all_targets GROUP BY table_name) x),
    'counts',(SELECT coalesce(jsonb_object_agg(table_name,n),'{}'::jsonb) FROM (SELECT table_name,count(*) n FROM all_targets GROUP BY table_name) x),
    'paymentTotal',(SELECT coalesce(sum(amount),0) FROM public."SupplierPayment" WHERE id IN (SELECT id FROM payments)),
    'guards',jsonb_build_object(
      'remainingCashPayments',(SELECT count(*) FROM public."DailyCashSupplierPayment" WHERE "cafeteriaId"=${cafe} AND "supplierPaymentId" NOT IN (SELECT id FROM payments)),
      'remainingUnpaidBills',(SELECT count(*) FROM public."SupplierBill" b JOIN public."SupplierInvoice" i ON i.id=b."invoiceId" WHERE b."cafeteriaId"=${cafe} AND b.status IN ('UNPAID','PARTIAL') AND i.status='FINALIZED' AND i.id NOT IN (SELECT id FROM invoices)),
      'mixedInvoiceLines',(SELECT count(*) FROM public."SupplierInvoiceItem" WHERE "invoiceId" IN (SELECT id FROM invoices) AND ("supplierCatalogItemId" IS NULL OR "supplierCatalogItemId" NOT IN (SELECT id FROM catalog))),
      'mixedOrderLines',(SELECT count(*) FROM public."SupplierPurchaseOrderItem" WHERE "purchaseOrderId" IN (SELECT id FROM orders) AND "supplierCatalogItemId" NOT IN (SELECT id FROM catalog)),
      'mixedRecurrenceLines',(SELECT count(*) FROM public."SupplierInvoiceRecurrenceItem" WHERE "recurrenceId" IN (SELECT id FROM recurrences) AND "supplierCatalogItemId" NOT IN (SELECT id FROM catalog)),
      'sharedPayments',(SELECT count(*) FROM public."SupplierPaymentAllocation" WHERE "supplierPaymentId" IN (SELECT id FROM payments) AND "billId" NOT IN (SELECT id FROM bills)),
      'recipes',(SELECT count(*) FROM public."RecipeIngredient" WHERE "supplyId" IN (SELECT id FROM supply)),
      'counts',(SELECT count(*) FROM public."InventoryCountLine" WHERE "supplyId" IN (SELECT id FROM supply) OR "stockEventId" IN (SELECT id FROM all_targets WHERE table_name='StockEvent')),
      'unrelatedLedger',(SELECT count(*) FROM public."StockEvent" WHERE "sourceId" IN (SELECT id FROM invoices) AND "sourceType"='SupplierInvoice' AND ("supplyId" IS NULL OR "supplyId" NOT IN (SELECT id FROM supply))),
      'crossCafeteria',(${deleteOrder.map((t) => `(SELECT count(*) FROM public."${t}" WHERE id IN (SELECT id FROM all_targets WHERE table_name='${t}') AND "cafeteriaId"<>${cafe})`).join("+")})
    ),
    'schemaDigest',${schemaDigest()},
    'cashFieldsDigest',${cashFieldsDigest(cafeteria)},
    'survivorDigests',jsonb_build_object(${deleteOrder.map((t) => `${quote(t)},${survivorDigest(t, `SELECT id FROM all_targets WHERE table_name=${quote(t)}`)}`).join(",")}),
    'inputDigests',jsonb_build_object(${[...new Set([...deleteOrder, ...cashTables])].map((t) => `${quote(t)},${tableDigest(t, cafeteria)}`).join(",")}),
    'protectedDigests',jsonb_build_object(${protectedTables.map((t) => `${quote(t)},${tableDigest(t, cafeteria)}`).join(",")})
  ) AS manifest;`;
}

export function cashRecalculationSql(cafeteria) {
  const cafe = quote(cafeteria);
  const iso = (expr) => `to_char(${expr}::timestamp,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
  return `
-- Calculate on the server; unrelated financial/staff rows are never exported.
CREATE TEMP TABLE reset_cash_results(day_id text PRIMARY KEY, payload json, revenue numeric, paid numeric, unpaid numeric, remaining numeric, savings numeric, additional numeric) ON COMMIT DROP;
CREATE FUNCTION pg_temp.reset_compact_json(v json) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $compact$
DECLARE output text;
BEGIN
  CASE json_typeof(v)
  WHEN 'object' THEN
    SELECT '{'||coalesce(string_agg(to_json(key)::text||':'||pg_temp.reset_compact_json(value),',' ORDER BY ord),'')||'}'
      INTO output FROM json_each(v) WITH ORDINALITY AS x(key,value,ord);
  WHEN 'array' THEN
    SELECT '['||coalesce(string_agg(pg_temp.reset_compact_json(value),',' ORDER BY ord),'')||']'
      INTO output FROM json_array_elements(v) WITH ORDINALITY AS x(value,ord);
  WHEN 'number' THEN output:=to_json((v::text)::double precision)::text;
  ELSE output:=v::text;
  END CASE;
  RETURN output;
END $compact$;
DO $cashguards$ BEGIN
  IF EXISTS(SELECT 1 FROM public."SupplierBill" b JOIN public."SupplierInvoice" i ON i.id=b."invoiceId" WHERE b."cafeteriaId"=${cafe} AND b.status IN ('UNPAID','PARTIAL') AND i.status='FINALIZED') THEN RAISE EXCEPTION 'Remaining supplier obligations require a new cash review'; END IF;
  IF EXISTS(SELECT 1 FROM public."DailyCashSupplierPayment" WHERE "cafeteriaId"=${cafe}) THEN RAISE EXCEPTION 'Remaining Daily Cash supplier payments require a new cash review'; END IF;
END $cashguards$;
WITH days AS (SELECT * FROM public."DailyCashDay" WHERE "cafeteriaId"=${cafe}),
supply_due AS (
  SELECT d.id AS day_id,s.id,s."purchaseDate",s."closedTotal" AS original,
    coalesce((SELECT sum(p.amount) FROM public."DailyCashSupplyPayment" p JOIN days paid_day ON paid_day.id=p."dailyCashDayId" WHERE p."supplyDayId"=s.id AND paid_day."businessDate"<=d."businessDate"),0) AS paid
  FROM days d JOIN public."SupplyDay" s ON s."cafeteriaId"=${cafe} AND s."closedAt" IS NOT NULL AND s."purchaseDate"<d."businessDate"
), input AS (
  SELECT d.*,
    coalesce((SELECT round(sum(s."closingAmount"),2) FROM public."Shift" s WHERE s."cafeteriaId"=${cafe} AND s."businessDate"=d."businessDate"-1 AND s."closingAmount" IS NOT NULL),0) AS revenue,
    d."salaryRevenueFunded"+coalesce((SELECT sum(m."revenueFunded") FROM public."DailyCashManualExpense" m WHERE m."dailyCashDayId"=d.id),0)+coalesce((SELECT sum(p."revenueFunded") FROM public."DailyCashSupplyPayment" p WHERE p."dailyCashDayId"=d.id),0) AS paid_revenue,
    d."salarySavingsFunded"+coalesce((SELECT sum(m."savingsFunded") FROM public."DailyCashManualExpense" m WHERE m."dailyCashDayId"=d.id),0)+coalesce((SELECT sum(p."savingsFunded") FROM public."DailyCashSupplyPayment" p WHERE p."dailyCashDayId"=d.id),0) AS paid_savings,
    CASE WHEN d."salaryPaidAt" IS NOT NULL OR d."salaryAmount"=0 THEN 0 ELSE d."salaryAmount" END+coalesce((SELECT sum(round(x.original-x.paid,2)) FROM supply_due x WHERE x.day_id=d.id AND round(x.original-x.paid,2)>0),0) AS unpaid,
    coalesce((SELECT sum(s.amount) FROM public."DailyCashSavingsDeposit" s WHERE s."dailyCashDayId"=d.id),0) AS deposited,
    json_build_object('version','daily-cash-v1','value',json_build_object(
      'dateKey',d."businessDate"::text,'waiterBalanceDateKey',(d."businessDate"-1)::text,
      'shifts',coalesce((SELECT json_agg(json_build_array(s.id,s."userId",round(s."closingAmount",2)) ORDER BY s.id COLLATE "C",s."userId" COLLATE "C") FROM public."Shift" s WHERE s."cafeteriaId"=${cafe} AND s."businessDate"=d."businessDate"-1 AND s."closingAmount" IS NOT NULL),'[]'::json),
      'missing',coalesce((SELECT json_agg(w.id ORDER BY w.id COLLATE "C") FROM public."Staff" w WHERE w."cafeteriaId"=${cafe} AND w.role='WAITER' AND w."isActive" AND NOT EXISTS(SELECT 1 FROM public."Shift" s WHERE s."cafeteriaId"=${cafe} AND s."businessDate"=d."businessDate"-1 AND s."closingAmount" IS NOT NULL AND s."userId"=w.id)),'[]'::json),
      'salary',json_build_array(d."salaryAmount",d."salaryOverridden",${iso('d."salaryPaidAt"')},d."salaryRevenueFunded",d."salarySavingsFunded"),
      'manual',coalesce((SELECT json_agg(json_build_array(m.id,m.description,m.note,m.amount,m."revenueFunded",m."savingsFunded") ORDER BY m."createdAt") FROM public."DailyCashManualExpense" m WHERE m."dailyCashDayId"=d.id),'[]'::json),
      'payments','[]'::json,
      'supplyPayments',coalesce((SELECT json_agg(json_build_array(p.id,p."supplyDayId",p.amount,p."revenueFunded",p."savingsFunded") ORDER BY p."createdAt") FROM public."DailyCashSupplyPayment" p WHERE p."dailyCashDayId"=d.id),'[]'::json),
      'supplyObligations',coalesce((SELECT json_agg(json_build_array(x.id,${iso('x."purchaseDate"')},x.original,x.paid,round(x.original-x.paid,2)) ORDER BY x."purchaseDate") FROM supply_due x WHERE x.day_id=d.id AND round(x.original-x.paid,2)>0),'[]'::json),
      'savingsDeposits',coalesce((SELECT json_agg(json_build_array(s.id,s.amount,s.note,s."recordedByUserId",${iso('s."createdAt"')}) ORDER BY s."createdAt") FROM public."DailyCashSavingsDeposit" s WHERE s."dailyCashDayId"=d.id),'[]'::json),
      'obligations','[]'::json
    )) AS payload
  FROM days d
)
INSERT INTO reset_cash_results
SELECT id,payload,revenue,paid_revenue+paid_savings,unpaid,
  round(greatest(0,greatest(0,revenue-paid_revenue-deposited)-unpaid),2),
  round(paid_savings,2),round(greatest(0,unpaid-greatest(0,revenue-paid_revenue-deposited)),2)
FROM input WHERE "finalizedAt" IS NOT NULL;
UPDATE public."DailyCashDay" d SET
  "finalizationFingerprint"=encode(sha256(convert_to(pg_temp.reset_compact_json(x.payload),'UTF8')),'hex'),
  "finalizedRevenue"=x.revenue,"finalizedPaidExpenses"=x.paid,"finalizedUnpaidRequired"=x.unpaid,
  "finalizedRemainingCash"=x.remaining,"finalizedSavingsUsed"=x.savings,"finalizedAdditionalSavingsRequired"=x.additional,
  "updatedAt"=CURRENT_TIMESTAMP
FROM reset_cash_results x WHERE x.day_id=d.id AND d."cafeteriaId"=${cafe};
DROP FUNCTION pg_temp.reset_compact_json(json);
`;
}

export function executeSql(manifest) {
  if (Object.values(manifest.guards).some((n) => Number(n) !== 0))
    throw new Error("Unreviewed shared dependency: " + JSON.stringify(manifest.guards));
  if (!manifest.targets.InventorySupply?.length)
    throw new Error("No inventory items in reviewed manifest");
  const cafe = quote(manifest.cafeteria);
  const ids = (t) => (manifest.targets[t] || []).map(quote).join(",") || "NULL";
  const guardDigests = Object.entries(manifest.inputDigests)
    .map(
      ([t, hash]) =>
        `IF ${tableDigest(t, manifest.cafeteria)} <> ${quote(hash)} THEN RAISE EXCEPTION 'Preflight changed: ${t}'; END IF;`,
    )
    .join("\n");
  const assertions = deleteOrder
    .map(
      (t) =>
        `IF (SELECT count(*) FROM public."${t}" WHERE id IN (${ids(t)}))<>${(manifest.targets[t] || []).length} THEN RAISE EXCEPTION 'Target count changed: ${t}'; END IF;`,
    )
    .join("\n");
  const deletes = deleteOrder
    .map(
      (t) =>
        `WITH deleted AS (DELETE FROM public."${t}" WHERE "cafeteriaId"=${cafe} AND id IN (${ids(t)}) RETURNING 1) INSERT INTO reset_deleted_counts SELECT '${t}',count(*) FROM deleted;`,
    )
    .join("\n");
  const deletedChecks = deleteOrder
    .map(
      (t) =>
        `IF (SELECT n FROM reset_deleted_counts WHERE table_name='${t}')<>${(manifest.targets[t] || []).length} THEN RAISE EXCEPTION 'Unexpected deleted count: ${t}'; END IF;`,
    )
    .join("\n");
  const protectedChecks = Object.entries(manifest.protectedDigests)
    .map(
      ([t, hash]) =>
        `IF ${tableDigest(t, manifest.cafeteria)}<>${quote(hash)} THEN RAISE EXCEPTION 'Protected data changed: ${t}'; END IF;`,
    )
    .join("\n");
  const survivorChecks = Object.entries(manifest.survivorDigests)
    .map(
      ([t, hash]) =>
        `IF ${survivorDigest(t, "SELECT NULL::text WHERE false")} IS DISTINCT FROM ${quote(hash)} THEN RAISE EXCEPTION 'Unrelated records changed: ${t}'; END IF;`,
    )
    .join("\n");
  return `BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
SELECT set_config('app.cafeteria_id',${cafe},true);
LOCK TABLE ${[...new Set([...deleteOrder, ...cashTables])]
    .sort()
    .map((t) => `public."${t}"`)
    .join(",")} IN SHARE ROW EXCLUSIVE MODE;
DO $check$ BEGIN
IF ${schemaDigest()}<>${quote(manifest.schemaDigest)} THEN RAISE EXCEPTION 'Database constraints or triggers changed'; END IF;
${guardDigests}
${assertions}
IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public."StockEvent"'::regclass AND tgname='StockEvent_immutable' AND tgenabled='O') THEN RAISE EXCEPTION 'Unexpected ledger trigger state'; END IF;
END $check$;
CREATE TEMP TABLE reset_deleted_counts(table_name text PRIMARY KEY,n integer) ON COMMIT DROP;
ALTER TABLE public."StockEvent" DISABLE TRIGGER "StockEvent_immutable";
${deletes}
ALTER TABLE public."StockEvent" ENABLE TRIGGER "StockEvent_immutable";
${cashRecalculationSql(manifest.cafeteria)}
SET CONSTRAINTS ALL IMMEDIATE;
DO $check$ BEGIN
${protectedChecks}
${survivorChecks}
IF ${cashFieldsDigest(manifest.cafeteria)}<>${quote(manifest.cashFieldsDigest)} THEN RAISE EXCEPTION 'Non-snapshot cash data changed'; END IF;
${deletedChecks}
IF EXISTS(SELECT 1 FROM public."InventorySupply" WHERE "cafeteriaId"=${cafe}) THEN RAISE EXCEPTION 'Inventory reset incomplete'; END IF;
END $check$;
SELECT set_config('inventory_reset.result',jsonb_build_object('deleted',(SELECT jsonb_object_agg(table_name,n) FROM reset_deleted_counts),'cashSnapshotsRecalculated',(SELECT count(*) FROM reset_cash_results),'cafeteria',${cafe})::text,false);
COMMIT;
SELECT current_setting('inventory_reset.result')::jsonb AS cleanup_result;`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "manifest") process.stdout.write(manifestQuery(args[0]));
  else if (command === "prepare") {
    const [inputPath, outputPath] = args;
    const manifest = JSON.parse(readFileSync(inputPath, "utf8"));
    writeFileSync(outputPath, executeSql(manifest));
    process.stdout.write(
      JSON.stringify(
        { counts: manifest.counts, paymentTotal: manifest.paymentTotal, guards: manifest.guards },
        null,
        2,
      ) + "\n",
    );
  } else throw new Error("Use manifest <cafeteria> or prepare <snapshot.json> <output.sql>");
}
