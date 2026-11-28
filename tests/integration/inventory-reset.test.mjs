import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import {
  deleteOrder,
  cashTables,
  protectedTables,
  manifestQuery,
  executeSql,
} from "../../scripts/maintenance/inventory-reset.mjs";

function loadMoney() {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync("src/lib/daily-cash/money.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports },
  );
  return exports;
}
const columns = {
  InventorySupply: 'name text, unit text, "stockQty" numeric',
  SupplierCatalogItem: '"inventorySupplyId" text, "productId" text',
  SupplierPurchaseOrderItem: '"purchaseOrderId" text, "supplierCatalogItemId" text',
  SupplierInvoice: '"purchaseOrderId" text, "recurrenceScheduleId" text, status text',
  SupplierInvoiceItem: '"invoiceId" text, "supplierCatalogItemId" text',
  SupplierInvoiceRecurrence: '"sourceInvoiceId" text',
  SupplierInvoiceRecurrenceItem: '"recurrenceId" text, "supplierCatalogItemId" text',
  SupplierBill: '"invoiceId" text, status text',
  SupplierInvoiceInstallment: '"invoiceId" text, "billId" text',
  SupplierPayment: "amount numeric",
  SupplierPaymentAllocation:
    '"supplierPaymentId" text, "billId" text, "installmentId" text, amount numeric',
  SupplierOrderRun: '"purchaseOrderId" text',
  SupplierOrderRunRecipient: '"runId" text',
  SupplierOrderWhatsAppDelivery: '"runId" text',
  SupplierOrderResponseItem: '"recipientId" text, "supplierCatalogItemId" text',
  SupplierReceiving: '"purchaseOrderId" text',
  SupplierReceivingItem: '"receivingId" text, "purchaseOrderItemId" text',
  InventoryMovement: '"supplyId" text, "itemType" text',
  StockEvent: '"supplyId" text, "productId" text, "sourceId" text, "sourceType" text',
  InventoryUnitConversion: '"supplyId" text',
  RecipeIngredient: '"supplyId" text',
  InventoryCountLine: '"supplyId" text, "stockEventId" text',
  AuditLog: '"entityType" text, "entityId" text',
  DailyCashDay: `"businessDate" date, "salaryAmount" numeric, "salaryOverridden" boolean, "salaryPaidAt" timestamp,
   "salaryRevenueFunded" numeric,"salarySavingsFunded" numeric,"finalizedAt" timestamp,"finalizedByUserId" text,
   "finalizationFingerprint" text,"finalizedRevenue" numeric,"finalizedPaidExpenses" numeric,"finalizedUnpaidRequired" numeric,
   "finalizedRemainingCash" numeric,"finalizedSavingsUsed" numeric,"finalizedAdditionalSavingsRequired" numeric,"updatedAt" timestamp`,
  DailyCashSupplierPayment:
    '"dailyCashDayId" text,"supplierPaymentId" text,amount numeric,"revenueFunded" numeric,"savingsFunded" numeric,"createdAt" timestamp',
  DailyCashManualExpense:
    '"dailyCashDayId" text,description text,note text,amount numeric,"revenueFunded" numeric,"savingsFunded" numeric,"createdAt" timestamp',
  DailyCashSupplyPayment:
    '"dailyCashDayId" text,"supplyDayId" text,amount numeric,"revenueFunded" numeric,"savingsFunded" numeric,"createdAt" timestamp',
  DailyCashSavingsDeposit:
    '"dailyCashDayId" text,amount numeric,note text,"recordedByUserId" text,"createdAt" timestamp',
  SupplyDay: '"purchaseDate" date,"closedAt" timestamp,"closedTotal" numeric',
  Shift: '"businessDate" date,"closingAmount" numeric,"userId" text',
  Staff: 'role text,"isActive" boolean',
};
const fks = [
  ["SupplierCatalogItem", "inventorySupplyId", "InventorySupply"],
  ["SupplierPurchaseOrderItem", "supplierCatalogItemId", "SupplierCatalogItem"],
  ["SupplierPurchaseOrderItem", "purchaseOrderId", "SupplierPurchaseOrder"],
  ["SupplierInvoice", "purchaseOrderId", "SupplierPurchaseOrder"],
  ["SupplierInvoice", "recurrenceScheduleId", "SupplierInvoiceRecurrence"],
  ["SupplierInvoiceItem", "invoiceId", "SupplierInvoice"],
  ["SupplierInvoiceItem", "supplierCatalogItemId", "SupplierCatalogItem"],
  ["SupplierInvoiceRecurrence", "sourceInvoiceId", "SupplierInvoice"],
  ["SupplierInvoiceRecurrenceItem", "recurrenceId", "SupplierInvoiceRecurrence"],
  ["SupplierInvoiceRecurrenceItem", "supplierCatalogItemId", "SupplierCatalogItem"],
  ["SupplierBill", "invoiceId", "SupplierInvoice"],
  ["SupplierInvoiceInstallment", "invoiceId", "SupplierInvoice"],
  ["SupplierInvoiceInstallment", "billId", "SupplierBill"],
  ["SupplierPaymentAllocation", "supplierPaymentId", "SupplierPayment"],
  ["SupplierPaymentAllocation", "billId", "SupplierBill"],
  ["SupplierPaymentAllocation", "installmentId", "SupplierInvoiceInstallment"],
  ["DailyCashSupplierPayment", "supplierPaymentId", "SupplierPayment"],
  ["DailyCashSupplierPayment", "dailyCashDayId", "DailyCashDay"],
  ["InventoryMovement", "supplyId", "InventorySupply"],
  ["StockEvent", "supplyId", "InventorySupply"],
  ["InventoryUnitConversion", "supplyId", "InventorySupply"],
  ["SupplierOrderRun", "purchaseOrderId", "SupplierPurchaseOrder"],
  ["SupplierOrderRunRecipient", "runId", "SupplierOrderRun"],
  ["SupplierOrderWhatsAppDelivery", "runId", "SupplierOrderRun"],
  ["SupplierOrderResponseItem", "recipientId", "SupplierOrderRunRecipient"],
  ["SupplierOrderResponseItem", "supplierCatalogItemId", "SupplierCatalogItem"],
  ["SupplierReceiving", "purchaseOrderId", "SupplierPurchaseOrder"],
  ["SupplierReceivingItem", "receivingId", "SupplierReceiving"],
  ["SupplierReceivingItem", "purchaseOrderItemId", "SupplierPurchaseOrderItem"],
  ["RecipeIngredient", "supplyId", "InventorySupply"],
  ["InventoryCountLine", "supplyId", "InventorySupply"],
  ["InventoryCountLine", "stockEventId", "StockEvent"],
];
async function fixture() {
  const db = new PGlite();
  for (const table of new Set([
    ...deleteOrder,
    ...cashTables,
    ...protectedTables,
    ...Object.keys(columns),
  ])) {
    await db.exec(
      `CREATE TABLE "${table}" (id text PRIMARY KEY,"cafeteriaId" text NOT NULL DEFAULT 'test-cafe'${columns[table] ? ", " + columns[table] : ""},UNIQUE("cafeteriaId",id));`,
    );
  }
  for (const [child, column, parent] of fks)
    await db.exec(
      `ALTER TABLE "${child}" ADD FOREIGN KEY ("${column}") REFERENCES "${parent}"(id) ${child === "SupplierInvoice" && column === "recurrenceScheduleId" ? "ON DELETE SET NULL" : ""};`,
    );
  await db.exec(`
 CREATE FUNCTION reject_stock_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'StockEvent records are immutable'; END $$;
 CREATE TRIGGER "StockEvent_immutable" BEFORE UPDATE OR DELETE ON "StockEvent" FOR EACH ROW EXECUTE FUNCTION reject_stock_event_mutation();
 INSERT INTO "InventorySupply"(id,"stockQty") VALUES ('supply',8);
 INSERT INTO "InventorySupply"(id,"cafeteriaId","stockQty") VALUES ('other-supply','other-cafe',19);
 INSERT INTO "SupplierCatalogItem"(id,"inventorySupplyId") VALUES ('catalog','supply');
 INSERT INTO "SupplierPurchaseOrder"(id) VALUES ('po');
 INSERT INTO "SupplierPurchaseOrderItem"(id,"purchaseOrderId","supplierCatalogItemId") VALUES ('po-line','po','catalog');
 INSERT INTO "SupplierInvoice"(id,"purchaseOrderId",status) VALUES ('invoice','po','FINALIZED');
 INSERT INTO "SupplierInvoiceItem"(id,"invoiceId","supplierCatalogItemId") VALUES ('invoice-line','invoice','catalog');
 INSERT INTO "SupplierInvoiceRecurrence"(id,"sourceInvoiceId") VALUES ('recurrence','invoice');
 INSERT INTO "SupplierInvoiceRecurrenceItem"(id,"recurrenceId","supplierCatalogItemId") VALUES ('recurrence-line','recurrence','catalog');
 INSERT INTO "SupplierInvoice"(id,"recurrenceScheduleId",status) VALUES ('generated','recurrence','DRAFT');
 INSERT INTO "SupplierInvoiceItem"(id,"invoiceId","supplierCatalogItemId") VALUES ('generated-line','generated','catalog');
 INSERT INTO "SupplierBill"(id,"invoiceId",status) VALUES ('bill','invoice','PAID');
 INSERT INTO "SupplierInvoiceInstallment"(id,"invoiceId","billId") VALUES ('installment','invoice','bill');
 INSERT INTO "SupplierPayment"(id,amount) VALUES ('payment',50),('unrelated-payment',12);
 INSERT INTO "SupplierInvoice"(id,status) VALUES ('unrelated-invoice','DRAFT');
 INSERT INTO "SupplierPaymentAllocation"(id,"supplierPaymentId","billId","installmentId",amount) VALUES ('allocation','payment','bill','installment',50);
 INSERT INTO "StockEvent"(id,"supplyId") VALUES ('event','supply'),('other-event','other-supply');
 INSERT INTO "InventoryMovement"(id,"supplyId","itemType") VALUES ('movement','supply','Supply');
 INSERT INTO "InventoryUnitConversion"(id,"supplyId") VALUES ('conversion','supply');
 INSERT INTO "SupplierReceiving"(id,"purchaseOrderId") VALUES ('receiving','po');
 INSERT INTO "SupplierReceivingItem"(id,"receivingId","purchaseOrderItemId") VALUES ('receiving-line','receiving','po-line');
 INSERT INTO "SupplierOrderRun"(id,"purchaseOrderId") VALUES ('run','po');
 INSERT INTO "SupplierOrderRunRecipient"(id,"runId") VALUES ('recipient','run');
 INSERT INTO "SupplierOrderWhatsAppDelivery"(id,"runId") VALUES ('delivery','run');
 INSERT INTO "SupplierOrderResponseItem"(id,"recipientId","supplierCatalogItemId") VALUES ('response','recipient','catalog');
 INSERT INTO "AuditLog"(id,"entityType","entityId") VALUES ('audit','InventorySupply','supply');
 INSERT INTO "Staff"(id,role,"isActive") VALUES ('waiter-a','WAITER',true),('waiter-b','WAITER',true);
 INSERT INTO "Shift"(id,"businessDate","closingAmount","userId") VALUES ('shift-a','2026-08-09',100,'waiter-a');
 INSERT INTO "DailyCashDay"(id,"businessDate","salaryAmount","salaryOverridden","salaryPaidAt","salaryRevenueFunded","salarySavingsFunded","finalizedAt","finalizedByUserId")
 VALUES ('day','2026-08-10',20,false,'2026-08-10T08:00:00Z',20,0,'2026-08-11T05:00:00Z','original-admin');
 INSERT INTO "DailyCashDay"(id,"businessDate","salaryAmount","salaryOverridden","salaryRevenueFunded","salarySavingsFunded") VALUES ('open-day','2026-08-11',20,false,0,0);
 INSERT INTO "DailyCashSupplierPayment"(id,"dailyCashDayId","supplierPaymentId",amount,"revenueFunded","savingsFunded","createdAt") VALUES ('cash-payment','day','payment',50,40,10,'2026-08-10');
 INSERT INTO "DailyCashManualExpense"(id,"dailyCashDayId",description,note,amount,"revenueFunded","savingsFunded","createdAt") VALUES ('manual','day','Tea " & sugar','keep this',5,1,4,'2026-08-10');
 INSERT INTO "SupplyDay"(id,"purchaseDate","closedAt","closedTotal") VALUES ('supply-day','2026-08-08','2026-08-08',10);
 INSERT INTO "DailyCashSupplyPayment"(id,"dailyCashDayId","supplyDayId",amount,"revenueFunded","savingsFunded","createdAt") VALUES ('supply-payment','day','supply-day',3,3,0,'2026-08-10');
 INSERT INTO "DailyCashSavingsDeposit"(id,"dailyCashDayId",amount,note,"recordedByUserId","createdAt") VALUES ('deposit','day',7,'retained','admin','2026-08-10');
 `);
  return db;
}
const manifest = async (db) => (await db.query(manifestQuery("test-cafe"))).rows[0].manifest;

test("manifest follows recurrence cycles and enumerates dependent receiving and scheduled-run records", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    assert.equal(m.counts.InventorySupply, 1);
    assert.equal(m.counts.SupplierInvoice, 2);
    assert.equal(m.counts.SupplierReceivingItem, 1);
    assert.equal(m.counts.SupplierOrderWhatsAppDelivery, 1);
    assert.ok(Object.values(m.guards).every((x) => x === 0));
    assert.equal(m.paymentTotal, 50);
  } finally {
    await db.close();
  }
});

test("cleanup is scoped, permanent and recomputes finalized cash with the application formula and fingerprint", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    await db.exec(executeSql(m));
    for (const [table, ids] of Object.entries(m.targets))
      assert.equal(
        (await db.query(`SELECT count(*)::int AS n FROM "${table}" WHERE id=ANY($1)`, [ids]))
          .rows[0].n,
        0,
      );
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "InventorySupply" WHERE id='other-supply'`))
        .rows[0].n,
      1,
    );
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "SupplierInvoice" WHERE id='unrelated-invoice'`))
        .rows[0].n,
      1,
    );
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "SupplierPayment" WHERE id='unrelated-payment'`))
        .rows[0].n,
      1,
    );
    const result = (await db.query(`SELECT * FROM "DailyCashDay" WHERE id='day'`)).rows[0];
    const summary = loadMoney().calculateDailyCashSummary({
      revenue: 100,
      paidRevenueFunded: 24,
      paidSavingsFunded: 4,
      unpaidRequired: 7,
      savingsDeposited: 7,
    });
    assert.equal(Number(result.finalizedRemainingCash), summary.projectedRemaining);
    assert.equal(Number(result.finalizedPaidExpenses), 28);
    assert.equal(Number(result.finalizedSavingsUsed), 4);
    const payload = {
      version: "daily-cash-v1",
      value: {
        dateKey: "2026-08-10",
        waiterBalanceDateKey: "2026-08-09",
        shifts: [["shift-a", "waiter-a", 100]],
        missing: ["waiter-b"],
        salary: [20, false, "2026-08-10T08:00:00.000Z", 20, 0],
        manual: [["manual", 'Tea " & sugar', "keep this", 5, 1, 4]],
        payments: [],
        supplyPayments: [["supply-payment", "supply-day", 3, 3, 0]],
        supplyObligations: [["supply-day", "2026-08-08T00:00:00.000Z", 10, 3, 7]],
        savingsDeposits: [["deposit", 7, "retained", "admin", "2026-08-10T00:00:00.000Z"]],
        obligations: [],
      },
    };
    assert.equal(
      result.finalizationFingerprint,
      createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    );
    assert.equal(result.finalizedByUserId, "original-admin");
    assert.equal(
      (await db.query(`SELECT "finalizedAt" FROM "DailyCashDay" WHERE id='open-day'`)).rows[0]
        .finalizedAt,
      null,
    );
    await assert.rejects(db.exec(`DELETE FROM "StockEvent" WHERE id='other-event'`), /immutable/);
  } finally {
    await db.close();
  }
});

test("changed manifest and unexpected shared dependencies prevent cleanup", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    await db.exec(`UPDATE "InventorySupply" SET "stockQty"=9 WHERE id='supply'`);
    await assert.rejects(db.exec(executeSql(m)), /Preflight changed/);
    await db.exec("ROLLBACK");
    assert.equal((await db.query(`SELECT count(*)::int n FROM "InventorySupply"`)).rows[0].n, 2);
    await db.exec(`INSERT INTO "RecipeIngredient"(id,"supplyId") VALUES ('recipe','supply')`);
    const changed = await manifest(db);
    assert.equal(changed.guards.recipes, 1);
    assert.throws(() => executeSql(changed), /Unreviewed shared dependency/);
  } finally {
    await db.close();
  }
});

test("a late transaction failure rolls back every deletion and restores the ledger trigger", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    const sql = executeSql(m).replace(
      "SET CONSTRAINTS ALL IMMEDIATE;",
      "DO $failure$ BEGIN RAISE EXCEPTION 'forced late failure'; END $failure$;",
    );
    await assert.rejects(db.exec(sql), /forced late failure/);
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "InventorySupply" WHERE id='supply'`)).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "SupplierInvoice" WHERE id='invoice'`)).rows[0]
        .n,
      1,
    );
    await assert.rejects(db.exec(`DELETE FROM "StockEvent" WHERE id='event'`), /immutable/);
  } finally {
    await db.close();
  }
});
