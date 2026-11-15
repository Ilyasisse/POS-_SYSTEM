import { expect, test } from "@jest/globals";
import { readFile } from "node:fs/promises";

import { MAX_EQUAL_SPLIT_PEOPLE, splitBillEqually } from "../../src/lib/payments/equal-bill-split";

test("splits a bill evenly without losing a cent", () => {
  const shares = splitBillEqually(10, 3);

  expect(shares).toStrictEqual([3.34, 3.33, 3.33]);
  expect(shares.reduce((sum, share) => sum + Math.round(share * 100), 0)).toBe(1_000);
});

test("supports exact divisions and the maximum payer count", () => {
  expect(splitBillEqually(12, 4)).toStrictEqual([3, 3, 3, 3]);
  expect(splitBillEqually(20, MAX_EQUAL_SPLIT_PEOPLE).length).toBe(20);
});

test("rejects invalid bill amounts and payer counts", () => {
  expect(() => splitBillEqually(0, 2)).toThrow(/greater than zero/);
  expect(() => splitBillEqually(Number.NaN, 2)).toThrow(/greater than zero/);
  expect(() => splitBillEqually(10, 1)).toThrow(/between 2 and 20/);
  expect(() => splitBillEqually(10, 2.5)).toThrow(/between 2 and 20/);
  expect(() => splitBillEqually(0.02, 3)).toThrow(/at least \$0.01/);
});

test("cashier payment UI exposes equal bill splitting", async () => {
  const component = await readFile(
    new URL("../../src/components/cashier/CashierPaymentDialog.tsx", import.meta.url),
    "utf8",
  );

  expect(component).toMatch(/splitBillEqually\(amountDue/);
  expect(component).toMatch(/Create equal shares/);
  expect(component).toMatch(/Number of people sharing the bill/);
});
