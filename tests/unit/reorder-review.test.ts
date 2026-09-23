import assert from "node:assert/strict";
import test from "node:test";
import {
  reorderStatus,
  validPurchaseItem,
} from "../../src/lib/inventory/reorder-review";

test("recognizes out and low stock using precise decimal thresholds", () => {
  assert.equal(reorderStatus("0", "5"), "OUT");
  assert.equal(reorderStatus("0.000001", "0.000001"), "LOW");
  assert.equal(reorderStatus("5.000001", "5"), null);
  assert.equal(reorderStatus("4", "0"), null);
});

test("only preselects a catalog item available to the selected supplier", () => {
  const available = [{ id: "one" }, { id: "two" }];
  assert.equal(validPurchaseItem("two", available), "two");
  assert.equal(validPurchaseItem("other-supplier", available), "");
  assert.equal(validPurchaseItem(undefined, available), "");
});
