import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_PAGE_SIZE,
  paginateInventorySupplies,
} from "../../src/lib/admin/inventory-pagination";

test("inventory pages contain the right rows and bounds", () => {
  const items = Array.from({ length: INVENTORY_PAGE_SIZE + 3 }, (_, i) => i);
  assert.deepEqual(paginateInventorySupplies(items, "2"), {
    page: 2,
    pageCount: 2,
    first: INVENTORY_PAGE_SIZE + 1,
    last: items.length,
    items: items.slice(INVENTORY_PAGE_SIZE),
  });
  assert.equal(paginateInventorySupplies(items, "999").page, 2);
  assert.equal(paginateInventorySupplies(items, "oops").page, 1);
  assert.equal(paginateInventorySupplies(items, "0").page, 1);
  assert.equal(paginateInventorySupplies(items, "1.5").page, 1);
});

test("empty filtered inventory reports zero visible rows", () => {
  assert.deepEqual(paginateInventorySupplies([], "4"), {
    page: 1,
    pageCount: 1,
    first: 0,
    last: 0,
    items: [],
  });
});
