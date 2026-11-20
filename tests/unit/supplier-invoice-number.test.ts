import { expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

import { formatSupplierInvoiceNumber } from "../../src/lib/suppliers/invoice-number";

const migration = fs.readFileSync(
  path.resolve("prisma/migrations/20260809_automatic_supplier_invoice_numbers/migration.sql"),
  "utf8",
);

test("formats supplier invoice numbers with a six-digit minimum", () => {
  expect(formatSupplierInvoiceNumber(1)).toBe("INV-000001");
  expect(formatSupplierInvoiceNumber(999999)).toBe("INV-999999");
  expect(formatSupplierInvoiceNumber(1000000)).toBe("INV-1000000");
});

test("invoice number migration preserves references and backfills chronologically", () => {
  expect(migration).toMatch(/RENAME COLUMN "invoiceNumber" TO "supplierReference"/);
  expect(migration).toMatch(/ROW_NUMBER\(\) OVER \(ORDER BY "createdAt" ASC, "id" ASC\)/);
});

test("invoice number migration installs a required unique database sequence", () => {
  expect(migration).toMatch(/CREATE SEQUENCE "SupplierInvoice_invoiceNumber_seq"/);
  expect(migration).toMatch(/ALTER COLUMN "invoiceNumber" SET NOT NULL/);
  expect(migration).toMatch(/ALTER COLUMN "invoiceNumber" SET DEFAULT nextval/);
  expect(migration).toMatch(/CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key"/);
});
