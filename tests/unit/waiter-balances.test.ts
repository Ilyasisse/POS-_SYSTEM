import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLedgerBusinessDate,
  calculateWaiterBalance,
  getBusinessDayRangeForKey,
  isLedgerActive,
  parseBusinessDateKey,
} from "../../src/lib/waiter/waiter-balance-calculations";

test("records a new shortage from sales and the end-day amount", () => {
  assert.deepEqual(calculateWaiterBalance(0, 100, 90), {
    dailyDifference: -10,
    endingBalance: -10,
  });
});

test("keeps prior debt until the waiter hands in enough to repay it", () => {
  assert.deepEqual(calculateWaiterBalance(-10, 100, 100), {
    dailyDifference: 0,
    endingBalance: -10,
  });
  assert.deepEqual(calculateWaiterBalance(-10, 100, 110), {
    dailyDifference: 10,
    endingBalance: 0,
  });
});

test("does not carry a positive waiter balance", () => {
  assert.deepEqual(calculateWaiterBalance(-5, 100, 120), {
    dailyDifference: 20,
    endingBalance: 0,
  });
});

test("rounds financial calculations to two decimal places", () => {
  assert.deepEqual(calculateWaiterBalance(-0.1, 10.015, 10), {
    dailyDifference: -0.02,
    endingBalance: -0.12,
  });
});

test("accepts only real ISO calendar dates", () => {
  assert.equal(parseBusinessDateKey("2026-07-01"), "2026-07-01");
  assert.equal(parseBusinessDateKey("2026-02-30"), null);
  assert.equal(parseBusinessDateKey("07/01/2026"), null);
});

test("blocks dates before activation and after the current business day", () => {
  const now = new Date(2026, 6, 3, 12, 0, 0);

  assert.throws(
    () => assertLedgerBusinessDate("2026-06-30", now),
    /July 1/,
  );
  assert.equal(assertLedgerBusinessDate("2026-07-03", now), "2026-07-03");
  assert.throws(
    () => assertLedgerBusinessDate("2026-07-04", now),
    /Future/,
  );
});

test("uses the established 7 AM to 5 AM POS business-day window", () => {
  const { start, end } = getBusinessDayRangeForKey("2026-07-01");

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 6);
  assert.equal(start.getDate(), 1);
  assert.equal(start.getHours(), 7);
  assert.equal(end.getDate(), 2);
  assert.equal(end.getHours(), 5);
});

test("activates at the start of the July 1 POS business day", () => {
  assert.equal(isLedgerActive(new Date(2026, 6, 1, 6, 59, 59)), false);
  assert.equal(isLedgerActive(new Date(2026, 6, 1, 7, 0, 0)), true);
});
