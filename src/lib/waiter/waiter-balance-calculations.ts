import { getCashierBusinessDayRange } from "@/lib/cashier/cashier-business-day";

export const WAITER_BALANCE_LEDGER_START_DATE = "2026-07-01";

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type WaiterBalanceCalculation = {
  dailyDifference: number;
  endingBalance: number;
};

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWaiterBalance(
  openingBalance: number,
  reportedSales: number,
  endDayAmount: number,
): WaiterBalanceCalculation {
  const dailyDifference = roundCurrency(endDayAmount - reportedSales);
  const rawEndingBalance = roundCurrency(openingBalance + dailyDifference);

  return {
    dailyDifference,
    endingBalance: Math.min(0, rawEndingBalance),
  };
}

export function parseBusinessDateKey(value: string) {
  if (!BUSINESS_DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

export function shiftBusinessDateKey(businessDateKey: string, dayOffset: number) {
  const parsed = parseBusinessDateKey(businessDateKey);

  if (!parsed) throw new Error("Invalid business date.");
  if (!Number.isInteger(dayOffset)) {
    throw new Error("Business date offset must be a whole number of days.");
  }

  const [year, month, day] = parsed.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return shifted.toISOString().slice(0, 10);
}

export function businessDateKeyToDatabaseDate(businessDateKey: string) {
  const parsed = parseBusinessDateKey(businessDateKey);

  if (!parsed) throw new Error("Invalid business date.");
  return new Date(`${parsed}T00:00:00.000Z`);
}

export function formatBusinessDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentBusinessDateKey(now: Date = new Date()) {
  return formatBusinessDateKey(getCashierBusinessDayRange(now).start);
}

export function getLatestCompletedBusinessDateKey(now: Date = new Date()) {
  const { start, end } = getCashierBusinessDayRange(now);
  const businessDateKey = formatBusinessDateKey(start);

  return now >= end
    ? businessDateKey
    : shiftBusinessDateKey(businessDateKey, -1);
}

export function getDefaultWaiterBalanceDateKey(now: Date = new Date()) {
  const latestCompletedBusinessDate = getLatestCompletedBusinessDateKey(now);

  return latestCompletedBusinessDate < WAITER_BALANCE_LEDGER_START_DATE
    ? WAITER_BALANCE_LEDGER_START_DATE
    : latestCompletedBusinessDate;
}

export function getBusinessDayRangeForKey(businessDateKey: string) {
  const parsed = parseBusinessDateKey(businessDateKey);

  if (!parsed) throw new Error("Invalid business date.");
  const [year, month, day] = parsed.split("-").map(Number);
  return getCashierBusinessDayRange(new Date(year, month - 1, day, 12, 0, 0));
}

export function assertLedgerBusinessDate(
  businessDateKey: string,
  now: Date = new Date(),
) {
  const parsed = parseBusinessDateKey(businessDateKey);

  if (!parsed) throw new Error("Invalid business date.");
  if (parsed < WAITER_BALANCE_LEDGER_START_DATE) {
    throw new Error("Waiter balances begin on July 1, 2026.");
  }
  if (parsed > getCurrentBusinessDateKey(now)) {
    throw new Error("Future business days cannot be edited.");
  }

  return parsed;
}

export function isLedgerActive(now: Date = new Date()) {
  return now >= getBusinessDayRangeForKey(WAITER_BALANCE_LEDGER_START_DATE).start;
}
