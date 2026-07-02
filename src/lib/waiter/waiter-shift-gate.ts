import type { Prisma } from "@prisma/client";
import { getCashierBusinessDayRange } from "@/lib/cashier/cashier-business-day";
import {
  businessDateKeyToDatabaseDate,
  getCurrentBusinessDateKey,
  isLedgerActive,
} from "@/lib/waiter/waiter-balance-calculations";

export function buildActiveWaiterShiftWhere(
  waiterId: string,
  now: Date = new Date(),
): Prisma.ShiftWhereInput {
  const { start, end } = getCashierBusinessDayRange(now);

  if (isLedgerActive(now)) {
    return {
      userId: waiterId,
      businessDate: businessDateKeyToDatabaseDate(
        getCurrentBusinessDateKey(now),
      ),
      closedAt: null,
    };
  }

  return {
    userId: waiterId,
    openedAt: { gte: start, lt: end },
    closedAt: null,
  };
}
