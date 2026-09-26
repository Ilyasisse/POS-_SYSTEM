import assert from "node:assert/strict";
import test from "node:test";
import { splitBillByItems } from "../../src/lib/payments/item-bill-split";

const items = [
  { id: "a", label: "Tea", amount: 2.35 },
  { id: "b", label: "Coffee", amount: 3.1 },
  { id: "c", label: "Cake", amount: 1.05 },
];

test("allocates exact cents for whole item lines", () => {
  assert.deepEqual(splitBillByItems(6.5, items, ["a", "c"]), [3.4, 3.1]);
});

test("rejects paid or adjusted balances and unknown item selections", () => {
  assert.throws(() => splitBillByItems(5.5, items, ["a"]), /after payments/);
  assert.throws(() => splitBillByItems(6.5, items, ["other"]), /changed/);
  assert.throws(() => splitBillByItems(6.5, items, ["a", "a"]), /Choose/);
});

test("requires a positive amount for both payers", () => {
  assert.throws(() => splitBillByItems(6.5, items, []), /Each payer/);
  assert.throws(
    () => splitBillByItems(6.5, items, ["a", "b", "c"]),
    /Each payer/,
  );
});
