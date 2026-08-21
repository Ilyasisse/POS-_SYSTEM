import {
  getCurrentBusinessDateKey,
  parseBusinessDateKey,
  shiftBusinessDateKey,
} from "@/lib/waiter/waiter-balance-calculations";

export const DAILY_CASH_START_DATE = "2026-08-01";
export const DAILY_CASH_LOCK_AGE_DAYS = 14;

export function getDailyCashDefaultDateKey(now = new Date()) {
  return getCurrentBusinessDateKey(now);
}

export function getDailyCashWaiterBalanceDateKey(
  dailyCashBusinessDate: string,
) {
  return shiftBusinessDateKey(dailyCashBusinessDate, -1);
}

export function isDailyCashLocked(businessDate: string, now = new Date()) {
  return businessDate <= shiftBusinessDateKey(
    getCurrentBusinessDateKey(now),
    -DAILY_CASH_LOCK_AGE_DAYS,
  );
}

export function assertDailyCashBusinessDate(businessDate: string, now = new Date()) {
  const parsed = parseBusinessDateKey(businessDate);
  if (!parsed) throw new Error("Choose a valid business date.");
  if (parsed < DAILY_CASH_START_DATE) {
    throw new Error("Daily Cash begins on August 1, 2026.");
  }
  if (parsed > getCurrentBusinessDateKey(now)) throw new Error("Future business days cannot be used.");
  return parsed;
}
