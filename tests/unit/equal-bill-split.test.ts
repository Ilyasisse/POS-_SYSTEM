import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_EQUAL_SPLIT_PEOPLE,
  splitBillEqually,
} from "../../src/lib/payments/equal-bill-split";

test("splits a bill evenly without losing a cent", () => {
  const shares = splitBillEqually(10, 3);

  assert.deepEqual(shares, [3.34, 3.33, 3.33]);
  assert.equal(
    shares.reduce((sum, share) => sum + Math.round(share * 100), 0),
    1_000,
  );
});

test("supports exact divisions and the maximum payer count", () => {
  assert.deepEqual(splitBillEqually(12, 4), [3, 3, 3, 3]);
  assert.equal(splitBillEqually(20, MAX_EQUAL_SPLIT_PEOPLE).length, 20);
});

test("rejects invalid bill amounts and payer counts", () => {
  assert.throws(() => splitBillEqually(0, 2), /greater than zero/);
  assert.throws(() => splitBillEqually(Number.NaN, 2), /greater than zero/);
  assert.throws(() => splitBillEqually(10, 1), /between 2 and 20/);
  assert.throws(() => splitBillEqually(10, 2.5), /between 2 and 20/);
  assert.throws(() => splitBillEqually(0.02, 3), /at least \$0.01/);
});

test("cashier payment UI exposes equal bill splitting", async () => {
  const component = await readFile(
    new URL(
      "../../src/components/cashier/CashierPaymentDialog.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(component, /splitBillEqually\(amountDue/);
  assert.match(component, /Create equal shares/);
  assert.match(component, /Number of people sharing the bill/);
});
