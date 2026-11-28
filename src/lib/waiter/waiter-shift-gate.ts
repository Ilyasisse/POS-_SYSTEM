import type { Prisma } from "@prisma/client";
import { getCashierBusinessDayRange } from "@/lib/cashier/cashier-business-day";
import {
  businessDateKeyToDatabaseDate,
  getCurrentBusinessDateKey,
  isLedgerActive,
} from "@/lib/waiter/waiter-balance-calculations";

export function buildActiveWaiterShiftWhere(
  waiterId: string | undefined,
  now: Date = new Date(),
): Prisma.ShiftWhereInput {
  const { start, end } = getCashierBusinessDayRange(now);
  const worker = waiterId === undefined ? {} : { userId: waiterId };

  if (isLedgerActive(now)) {
    return {
      ...worker,
      businessDate: businessDateKeyToDatabaseDate(
        getCurrentBusinessDateKey(now),
      ),
      closedAt: null,
    };
  }

  return {
    ...worker,
    openedAt: { gte: start, lt: end },
    closedAt: null,
  };
}
