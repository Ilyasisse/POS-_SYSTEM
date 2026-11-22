import { expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "prisma/migrations/20260724_legacy_supplier_invoice_conversion/migration.sql",
  "utf8",
);

test("legacy conversion maps every delivery status to its invoice lifecycle", () => {
  expect(migration).toMatch(/WHEN 'VERIFIED' THEN 'FINALIZED'/);
  expect(migration).toMatch(/WHEN 'REJECTED' THEN 'VOID'/);
  expect(migration).toMatch(/ELSE 'DRAFT'/);
  expect(migration).toMatch(/'LEGACY_UPLOAD'::"SupplierInvoiceSource"/);
});

test("legacy conversion preserves IDs, receipts, audit timestamps, and bill payments", () => {
  expect(migration).toMatch(/delivery\."id",\s*delivery\."supplierId"/);
  expect(migration).toMatch(/delivery\."receiptObjectPath"/);
  expect(migration).toMatch(/delivery\."inventoryUpdatedAt"/);
  expect(migration).toMatch(/"invoiceId" = "deliveryId"/);
  expect(migration).toMatch(/SELECT COUNT\(\*\) FROM "SupplierPayment"/);
  expect(migration).not.toMatch(/DELETE FROM "SupplierPayment"/i);
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

  expect(invoiceAudit >= 0 && invoiceAudit < dropDelivery).toBeTruthy();
  expect(lineAudit >= 0 && lineAudit < dropDelivery).toBeTruthy();
  expect(billAudit >= 0 && billAudit < dropDelivery).toBeTruthy();
  expect(paymentAudit >= 0 && paymentAudit < dropDelivery).toBeTruthy();
});
