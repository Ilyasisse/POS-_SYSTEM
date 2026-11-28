import assert from "node:assert/strict";
import test from "node:test";
import {
  purchaseOrderFilterQuery,
  purchaseOrderPage,
} from "../../src/lib/suppliers/purchase-order-pagination";

test("purchase order pages reach beyond the former 500-order limit", () => {
  assert.deepEqual(purchaseOrderPage("11", 551), {
    page: 11,
    totalPages: 12,
    skip: 500,
  });
  assert.deepEqual(purchaseOrderPage("9999", 51), {
    page: 2,
    totalPages: 2,
    skip: 50,
  });
  assert.deepEqual(purchaseOrderPage("0", 0), {
    page: 1,
    totalPages: 1,
    skip: 0,
  });
  assert.equal(purchaseOrderPage("bad", 55).page, 1);
});

test("page navigation retains both supplier and status filters", () => {
  assert.equal(
    purchaseOrderFilterQuery("supplier with spaces", "OPEN"),
    "?supplier=supplier+with+spaces&status=OPEN",
  );
  assert.equal(purchaseOrderFilterQuery(), "");
});
