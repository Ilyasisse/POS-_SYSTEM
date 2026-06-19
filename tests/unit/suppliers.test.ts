import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidSupplierSlug,
  normalizeEmail,
  normalizeSupplierSlug,
  safeInternalReturnPath,
} from "../../src/lib/suppliers/validation";

test("normalizes supplier identity fields", () => {
  assert.equal(normalizeEmail("  Supplier@Example.COM "), "supplier@example.com");
  assert.equal(normalizeSupplierSlug(" Fresh Beans Ltd. "), "fresh-beans-ltd");
  assert.equal(isValidSupplierSlug("fresh-beans-ltd"), true);
  assert.equal(isValidSupplierSlug("../fresh"), false);
});

test("only permits internal OAuth return paths", () => {
  assert.equal(safeInternalReturnPath("/supplier/fresh-beans?ready=1"), "/supplier/fresh-beans?ready=1");
  assert.equal(safeInternalReturnPath("//evil.example/path"), null);
  assert.equal(safeInternalReturnPath("https://evil.example/path"), null);
});
