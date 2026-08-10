import {
  getCurrentBusinessDateKey,
  parseBusinessDateKey,
  shiftBusinessDateKey,
} from "@/lib/waiter/waiter-balance-calculations";

export function getDailyCashDefaultDateKey(now = new Date()) {
  return getCurrentBusinessDateKey(now);
}

export function getDailyCashWaiterBalanceDateKey(
  dailyCashBusinessDate: string,
) {
  return shiftBusinessDateKey(dailyCashBusinessDate, -1);
}

export function isDailyCashLocked(businessDate: string, now = new Date()) {
  return businessDate <= shiftBusinessDateKey(getCurrentBusinessDateKey(now), -7);
}

export function assertDailyCashBusinessDate(businessDate: string, now = new Date()) {
  const parsed = parseBusinessDateKey(businessDate);
  if (!parsed) throw new Error("Choose a valid business date.");
  if (parsed > getCurrentBusinessDateKey(now)) throw new Error("Future business days cannot be used.");
  return parsed;
}
