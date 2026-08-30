import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCurrencyPrecision,
  parseCurrencyAmount,
} from "../../src/lib/currency/amount-input";
import {
  buildWaiterBalanceWaiterWhere,
  getWaiterBalanceCapabilities,
} from "../../src/lib/waiter/waiter-balance-access";
import {
  assertLedgerBusinessDate,
  calculateWaiterBalance,
  getCurrentBusinessDateKey,
  getDefaultWaiterBalanceDateKey,
  getBusinessDayRangeForKey,
  getLatestCompletedBusinessDateKey,
  isLedgerActive,
  parseBusinessDateKey,
  shiftBusinessDateKey,
} from "../../src/lib/waiter/waiter-balance-calculations";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "../../src/lib/cashier/cashier-business-day";
import { buildActiveWaiterShiftWhere } from "../../src/lib/waiter/waiter-shift-gate";

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

test("blocks dates before activation and before the POS day has closed", () => {
  const now = new Date("2026-07-03T09:00:00.000Z");

  assert.throws(
    () => assertLedgerBusinessDate("2026-06-30", now),
    /July 1/,
  );
  assert.equal(assertLedgerBusinessDate("2026-07-02", now), "2026-07-02");
  assert.throws(
    () => assertLedgerBusinessDate("2026-07-03", now),
    /after the POS business day closes/,
  );
});

test("opens a waiter balance at the 5 AM POS close boundary", () => {
  assert.throws(
    () =>
      assertLedgerBusinessDate(
        "2026-08-09",
        new Date("2026-08-10T01:59:59.000Z"),
      ),
    /after the POS business day closes/,
  );
  assert.equal(
    assertLedgerBusinessDate(
      "2026-08-09",
      new Date("2026-08-10T02:00:00.000Z"),
    ),
    "2026-08-09",
  );
  assert.equal(
    assertLedgerBusinessDate(
      "2026-08-09",
      new Date("2026-08-10T04:00:00.000Z"),
    ),
    "2026-08-09",
  );
});

test("uses the established 7 AM to 5 AM POS business-day window", () => {
  const { start, end } = getBusinessDayRangeForKey("2026-07-01");

  assert.equal(start.toISOString(), "2026-07-01T04:00:00.000Z");
  assert.equal(end.toISOString(), "2026-07-02T02:00:00.000Z");
  assert.equal(
    formatCashierBusinessDayRange(start, end),
    "Jul 1 7:00 AM to Jul 2 5:00 AM",
  );
});

test("keeps the most recently completed POS window during the 5 AM to 7 AM gap", () => {
  const { start, end } = getCashierBusinessDayRange(
    new Date("2026-07-23T03:59:59.000Z"),
  );

  assert.equal(start.toISOString(), "2026-07-22T04:00:00.000Z");
  assert.equal(end.toISOString(), "2026-07-23T02:00:00.000Z");
});

test("derives the latest completed waiter-balance date across POS boundaries", () => {
  const cases = [
    {
      now: new Date("2026-07-23T01:59:59.000Z"),
      current: "2026-07-22",
      latestCompleted: "2026-07-21",
    },
    {
      now: new Date("2026-07-23T02:00:00.000Z"),
      current: "2026-07-22",
      latestCompleted: "2026-07-22",
    },
    {
      now: new Date("2026-07-23T03:59:59.000Z"),
      current: "2026-07-22",
      latestCompleted: "2026-07-22",
    },
    {
      now: new Date("2026-07-23T04:00:00.000Z"),
      current: "2026-07-23",
      latestCompleted: "2026-07-22",
    },
  ];

  for (const { now, current, latestCompleted } of cases) {
    assert.equal(getCurrentBusinessDateKey(now), current);
    assert.equal(getLatestCompletedBusinessDateKey(now), latestCompleted);
  }
});

test("unlocks August 10 and activates August 11 at 7:04 AM Nairobi time", () => {
  const now = new Date("2026-08-11T04:04:00.000Z");

  assert.equal(getCurrentBusinessDateKey(now), "2026-08-11");
  assert.equal(getLatestCompletedBusinessDateKey(now), "2026-08-10");
  assert.equal(assertLedgerBusinessDate("2026-08-10", now), "2026-08-10");
});

test("shifts ISO business dates with calendar-safe UTC arithmetic", () => {
  assert.equal(shiftBusinessDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftBusinessDateKey("2027-01-01", -1), "2026-12-31");
  assert.throws(() => shiftBusinessDateKey("2026-02-30", -1), /Invalid/);
  assert.throws(() => shiftBusinessDateKey("2026-07-01", 0.5), /whole number/);
});

test("clamps the default waiter-balance date to ledger activation", () => {
  assert.equal(
    getDefaultWaiterBalanceDateKey(new Date("2026-07-01T04:00:00.000Z")),
    "2026-07-01",
  );
});

test("activates at the start of the July 1 POS business day", () => {
  assert.equal(
    isLedgerActive(new Date("2026-07-01T03:59:59.000Z")),
    false,
  );
  assert.equal(
    isLedgerActive(new Date("2026-07-01T04:00:00.000Z")),
    true,
  );
});

test("strictly parses currency form input", () => {
  assert.equal(parseCurrencyAmount("0"), 0);
  assert.equal(parseCurrencyAmount("12.34"), 12.34);
  assert.equal(hasCurrencyPrecision(0.29), true);
  assert.equal(hasCurrencyPrecision(10.015), false);
  assert.equal(parseCurrencyAmount("10.015"), null);
  assert.equal(parseCurrencyAmount("1e3"), null);
  assert.equal(parseCurrencyAmount("-1"), null);
  assert.equal(
    parseCurrencyAmount("-10.50", {
      allowNegative: true,
      requireNonPositive: true,
    }),
    -10.5,
  );
  assert.equal(
    parseCurrencyAmount("0.00", {
      allowNegative: true,
      requireNonPositive: true,
    }),
    0,
  );
  assert.equal(
    parseCurrencyAmount("1.00", {
      allowNegative: true,
      requireNonPositive: true,
    }),
    null,
  );
});

test("uses business date for active waiter ordering gate after ledger activation", () => {
  const where = buildActiveWaiterShiftWhere(
    "waiter-1",
    new Date("2026-07-01T09:00:00.000Z"),
  );

  assert.equal(where.userId, "waiter-1");
  assert.equal(where.closedAt, null);
  assert.equal(where.openedAt, undefined);
  assert.equal(
    where.businessDate instanceof Date
      ? where.businessDate.toISOString().slice(0, 10)
      : null,
    "2026-07-01",
  );
});

test("uses openedAt range for active waiter ordering gate before ledger activation", () => {
  const where = buildActiveWaiterShiftWhere(
    "waiter-1",
    new Date("2026-06-30T09:00:00.000Z"),
  );

  assert.equal(where.userId, "waiter-1");
  assert.equal(where.closedAt, null);
  assert.equal(where.businessDate, undefined);
  assert.ok(where.openedAt);
});

test("hides inactive waiters by default on the balance page", () => {
  assert.deepEqual(buildWaiterBalanceWaiterWhere(), {
    role: "WAITER",
    isActive: true,
  });
  assert.deepEqual(buildWaiterBalanceWaiterWhere(true), {
    role: "WAITER",
  });
});

test("derives waiter balance capabilities from activity and settlement state", () => {
  assert.deepEqual(
    getWaiterBalanceCapabilities({
      isActive: true,
      hasInitialization: false,
      hasClosedShift: false,
    }),
    {
      canInitialize: true,
      canEditSettlement: false,
    },
  );
  assert.deepEqual(
    getWaiterBalanceCapabilities({
      isActive: false,
      hasInitialization: true,
      hasClosedShift: true,
    }),
    {
      canInitialize: false,
      canEditSettlement: true,
    },
  );
  assert.deepEqual(
    getWaiterBalanceCapabilities({
      isActive: false,
      hasInitialization: true,
      hasClosedShift: false,
    }),
    {
      canInitialize: false,
      canEditSettlement: false,
    },
  );
});
