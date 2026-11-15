import { expect, test } from "@jest/globals";

import { hasCurrencyPrecision, parseCurrencyAmount } from "../../src/lib/currency/amount-input";
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
  expect(calculateWaiterBalance(0, 100, 90)).toStrictEqual({
    dailyDifference: -10,
    endingBalance: -10,
  });
});

test("keeps prior debt until the waiter hands in enough to repay it", () => {
  expect(calculateWaiterBalance(-10, 100, 100)).toStrictEqual({
    dailyDifference: 0,
    endingBalance: -10,
  });
  expect(calculateWaiterBalance(-10, 100, 110)).toStrictEqual({
    dailyDifference: 10,
    endingBalance: 0,
  });
});

test("does not carry a positive waiter balance", () => {
  expect(calculateWaiterBalance(-5, 100, 120)).toStrictEqual({
    dailyDifference: 20,
    endingBalance: 0,
  });
});

test("rounds financial calculations to two decimal places", () => {
  expect(calculateWaiterBalance(-0.1, 10.015, 10)).toStrictEqual({
    dailyDifference: -0.02,
    endingBalance: -0.12,
  });
});

test("accepts only real ISO calendar dates", () => {
  expect(parseBusinessDateKey("2026-07-01")).toBe("2026-07-01");
  expect(parseBusinessDateKey("2026-02-30")).toBe(null);
  expect(parseBusinessDateKey("07/01/2026")).toBe(null);
});

test("blocks dates before activation and before the POS day has closed", () => {
  const now = new Date("2026-07-03T09:00:00.000Z");

  expect(() => assertLedgerBusinessDate("2026-06-30", now)).toThrow(/July 1/);
  expect(assertLedgerBusinessDate("2026-07-02", now)).toBe("2026-07-02");
  expect(() => assertLedgerBusinessDate("2026-07-03", now)).toThrow(
    /after the POS business day closes/,
  );
});

test("opens a waiter balance at the 5 AM POS close boundary", () => {
  expect(() =>
    assertLedgerBusinessDate("2026-08-09", new Date("2026-08-10T01:59:59.000Z")),
  ).toThrow(/after the POS business day closes/);
  expect(assertLedgerBusinessDate("2026-08-09", new Date("2026-08-10T02:00:00.000Z"))).toBe(
    "2026-08-09",
  );
  expect(assertLedgerBusinessDate("2026-08-09", new Date("2026-08-10T04:00:00.000Z"))).toBe(
    "2026-08-09",
  );
});

test("uses the established 7 AM to 5 AM POS business-day window", () => {
  const { start, end } = getBusinessDayRangeForKey("2026-07-01");

  expect(start.toISOString()).toBe("2026-07-01T04:00:00.000Z");
  expect(end.toISOString()).toBe("2026-07-02T02:00:00.000Z");
  expect(formatCashierBusinessDayRange(start, end)).toBe("Jul 1 7:00 AM to Jul 2 5:00 AM");
});

test("keeps the most recently completed POS window during the 5 AM to 7 AM gap", () => {
  const { start, end } = getCashierBusinessDayRange(new Date("2026-07-23T03:59:59.000Z"));

  expect(start.toISOString()).toBe("2026-07-22T04:00:00.000Z");
  expect(end.toISOString()).toBe("2026-07-23T02:00:00.000Z");
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
    expect(getCurrentBusinessDateKey(now)).toBe(current);
    expect(getLatestCompletedBusinessDateKey(now)).toBe(latestCompleted);
  }
});

test("unlocks August 10 and activates August 11 at 7:04 AM Nairobi time", () => {
  const now = new Date("2026-08-11T04:04:00.000Z");

  expect(getCurrentBusinessDateKey(now)).toBe("2026-08-11");
  expect(getLatestCompletedBusinessDateKey(now)).toBe("2026-08-10");
  expect(assertLedgerBusinessDate("2026-08-10", now)).toBe("2026-08-10");
});

test("shifts ISO business dates with calendar-safe UTC arithmetic", () => {
  expect(shiftBusinessDateKey("2026-03-01", -1)).toBe("2026-02-28");
  expect(shiftBusinessDateKey("2027-01-01", -1)).toBe("2026-12-31");
  expect(() => shiftBusinessDateKey("2026-02-30", -1)).toThrow(/Invalid/);
  expect(() => shiftBusinessDateKey("2026-07-01", 0.5)).toThrow(/whole number/);
});

test("clamps the default waiter-balance date to ledger activation", () => {
  expect(getDefaultWaiterBalanceDateKey(new Date("2026-07-01T04:00:00.000Z"))).toBe("2026-07-01");
});

test("activates at the start of the July 1 POS business day", () => {
  expect(isLedgerActive(new Date("2026-07-01T03:59:59.000Z"))).toBe(false);
  expect(isLedgerActive(new Date("2026-07-01T04:00:00.000Z"))).toBe(true);
});

test("strictly parses currency form input", () => {
  expect(parseCurrencyAmount("0")).toBe(0);
  expect(parseCurrencyAmount("12.34")).toBe(12.34);
  expect(hasCurrencyPrecision(0.29)).toBe(true);
  expect(hasCurrencyPrecision(10.015)).toBe(false);
  expect(parseCurrencyAmount("10.015")).toBe(null);
  expect(parseCurrencyAmount("1e3")).toBe(null);
  expect(parseCurrencyAmount("-1")).toBe(null);
  expect(
    parseCurrencyAmount("-10.50", {
      allowNegative: true,
      requireNonPositive: true,
    }),
  ).toBe(-10.5);
  expect(
    parseCurrencyAmount("0.00", {
      allowNegative: true,
      requireNonPositive: true,
    }),
  ).toBe(0);
  expect(
    parseCurrencyAmount("1.00", {
      allowNegative: true,
      requireNonPositive: true,
    }),
  ).toBe(null);
});

test("uses business date for active waiter ordering gate after ledger activation", () => {
  const where = buildActiveWaiterShiftWhere("waiter-1", new Date("2026-07-01T09:00:00.000Z"));

  expect(where.userId).toBe("waiter-1");
  expect(where.closedAt).toBe(null);
  expect(where.openedAt).toBe(undefined);
  expect(
    where.businessDate instanceof Date ? where.businessDate.toISOString().slice(0, 10) : null,
  ).toBe("2026-07-01");
});

test("uses openedAt range for active waiter ordering gate before ledger activation", () => {
  const where = buildActiveWaiterShiftWhere("waiter-1", new Date("2026-06-30T09:00:00.000Z"));

  expect(where.userId).toBe("waiter-1");
  expect(where.closedAt).toBe(null);
  expect(where.businessDate).toBe(undefined);
  expect(where.openedAt).toBeTruthy();
});

test("hides inactive waiters by default on the balance page", () => {
  expect(buildWaiterBalanceWaiterWhere()).toStrictEqual({
    role: "WAITER",
    isActive: true,
  });
  expect(buildWaiterBalanceWaiterWhere(true)).toStrictEqual({
    role: "WAITER",
  });
});

test("derives waiter balance capabilities from activity and settlement state", () => {
  expect(
    getWaiterBalanceCapabilities({
      isActive: true,
      hasInitialization: false,
      hasClosedShift: false,
    }),
  ).toStrictEqual({
    canInitialize: true,
    canEditSettlement: false,
  });
  expect(
    getWaiterBalanceCapabilities({
      isActive: false,
      hasInitialization: true,
      hasClosedShift: true,
    }),
  ).toStrictEqual({
    canInitialize: false,
    canEditSettlement: true,
  });
  expect(
    getWaiterBalanceCapabilities({
      isActive: false,
      hasInitialization: true,
      hasClosedShift: false,
    }),
  ).toStrictEqual({
    canInitialize: false,
    canEditSettlement: false,
  });
});
