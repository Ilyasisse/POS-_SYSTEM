import { roundMoney } from "./money";

type DailyCashShift = {
  id: string;
  userId: string;
  closingAmount: number | null;
};

type ActiveWaiter = {
  id: string;
  fullName: string;
};

export function summarizeDailyCashShiftCash(
  shifts: readonly DailyCashShift[],
  activeWaiters: readonly ActiveWaiter[],
) {
  const shiftsWithEndDayAmount = shifts.filter(
    (shift): shift is DailyCashShift & { closingAmount: number } =>
      shift.closingAmount !== null,
  );
  const settledWaiterIds = new Set(
    shiftsWithEndDayAmount.map((shift) => shift.userId),
  );

  return {
    endDayCash: roundMoney(
      shiftsWithEndDayAmount.reduce(
        (sum, shift) => sum + shift.closingAmount,
        0,
      ),
    ),
    missingWaiters: activeWaiters.filter(
      (waiter) => !settledWaiterIds.has(waiter.id),
    ),
    fingerprintRows: shiftsWithEndDayAmount
      .map(
        (shift) =>
          [shift.id, shift.userId, roundMoney(shift.closingAmount)] as const,
      )
      .sort(
        (left, right) =>
          left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]),
      ),
  };
}
