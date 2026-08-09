import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { formatSupplierInvoiceNumber } from "../../src/lib/suppliers/invoice-number";

const migration = fs.readFileSync(
  path.resolve(
    "prisma/migrations/20260809_automatic_supplier_invoice_numbers/migration.sql",
  ),
  "utf8",
);

test("formats supplier invoice numbers with a six-digit minimum", () => {
  assert.equal(formatSupplierInvoiceNumber(1), "INV-000001");
  assert.equal(formatSupplierInvoiceNumber(999999), "INV-999999");
  assert.equal(formatSupplierInvoiceNumber(1000000), "INV-1000000");
});

test("invoice number migration preserves references and backfills chronologically", () => {
  assert.match(
    migration,
    /RENAME COLUMN "invoiceNumber" TO "supplierReference"/,
  );
  assert.match(
    migration,
    /ROW_NUMBER\(\) OVER \(ORDER BY "createdAt" ASC, "id" ASC\)/,
  );
});

test("invoice number migration installs a required unique database sequence", () => {
  assert.match(migration, /CREATE SEQUENCE "SupplierInvoice_invoiceNumber_seq"/);
  assert.match(migration, /ALTER COLUMN "invoiceNumber" SET NOT NULL/);
  assert.match(migration, /ALTER COLUMN "invoiceNumber" SET DEFAULT nextval/);
  assert.match(migration, /CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key"/);
});
