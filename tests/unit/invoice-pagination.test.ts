import assert from "node:assert/strict";
import test from "node:test";
import {
  supplierInvoiceFilterQuery,
  supplierInvoicePage,
} from "../../src/lib/suppliers/invoice-pagination";

test("all supplier invoices remain reachable beyond the old limit", () => {
  assert.deepEqual(supplierInvoicePage("11", 551), {
    page: 11,
    totalPages: 12,
    skip: 500,
  });
  assert.equal(supplierInvoicePage("999", 51).page, 2);
  assert.equal(supplierInvoicePage("bad", 0).skip, 0);
});

test("invoice pagination keeps supplier and display status filters", () => {
  assert.equal(
    supplierInvoiceFilterQuery("supplier A", "PARTIALLY_PAID"),
    "?supplier=supplier+A&status=PARTIALLY_PAID",
  );
  assert.equal(supplierInvoiceFilterQuery(), "");
});
