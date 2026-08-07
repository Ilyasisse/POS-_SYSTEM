import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidSupplierSlug,
  normalizeSupplierSlug,
} from "../../src/lib/suppliers/validation";

test("normalizes supplier identity fields", () => {
  assert.equal(normalizeSupplierSlug(" Fresh Beans Ltd. "), "fresh-beans-ltd");
  assert.equal(isValidSupplierSlug("fresh-beans-ltd"), true);
  assert.equal(isValidSupplierSlug("../fresh"), false);
});
