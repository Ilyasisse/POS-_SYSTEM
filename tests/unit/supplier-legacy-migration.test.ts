import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260724_legacy_supplier_invoice_conversion/migration.sql",
  "utf8",
);

test("legacy conversion maps every delivery status to its invoice lifecycle", () => {
  assert.match(migration, /WHEN 'VERIFIED' THEN 'FINALIZED'/);
  assert.match(migration, /WHEN 'REJECTED' THEN 'VOID'/);
  assert.match(migration, /ELSE 'DRAFT'/);
  assert.match(migration, /'LEGACY_UPLOAD'::"SupplierInvoiceSource"/);
});

test("legacy conversion preserves IDs, receipts, audit timestamps, and bill payments", () => {
  assert.match(migration, /delivery\."id",\s*delivery\."supplierId"/);
  assert.match(migration, /delivery\."receiptObjectPath"/);
  assert.match(migration, /delivery\."inventoryUpdatedAt"/);
  assert.match(migration, /"invoiceId" = "deliveryId"/);
  assert.match(migration, /SELECT COUNT\(\*\) FROM "SupplierPayment"/);
  assert.doesNotMatch(migration, /DELETE FROM "SupplierPayment"/i);
});

test("legacy tables are dropped only after record, line, bill, and payment audits", () => {
  const invoiceAudit = migration.indexOf(
    "Legacy supplier conversion did not create every invoice.",
  );
  const lineAudit = migration.indexOf(
    "Legacy supplier conversion did not create every invoice line.",
  );
  const billAudit = migration.indexOf(
    "Legacy supplier conversion did not move every supplier bill.",
  );
  const paymentAudit = migration.indexOf(
    "Legacy supplier conversion changed supplier payment history.",
  );
  const dropDelivery = migration.indexOf('DROP TABLE "SupplierDelivery"');

  assert.ok(invoiceAudit >= 0 && invoiceAudit < dropDelivery);
  assert.ok(lineAudit >= 0 && lineAudit < dropDelivery);
  assert.ok(billAudit >= 0 && billAudit < dropDelivery);
  assert.ok(paymentAudit >= 0 && paymentAudit < dropDelivery);
});
