import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCashierBusinessDayRange } from "@/lib/cashier/cashier-business-day";
import { buildActiveWaiterShiftWhere } from "@/lib/waiter/waiter-shift-gate";
import {
  businessDateKeyToDatabaseDate,
  calculateWaiterBalance,
  getCurrentBusinessDateKey,
  getWaiterOpeningBalanceForBusinessDate,
  isLedgerActive,
  reopenWaiterSettlement,
  roundCurrency,
  saveWaiterSettlement,
  WAITER_BALANCE_LEDGER_START_DATE,
} from "@/lib/waiter/waiter-balance-ledger";

export type WaiterShiftSummary = {
  shiftId: string | null;
  status: "not_opened" | "open" | "closed";
  openingAmount: number;
  closingAmount: number | null;
  totalSales: number;
  posSales: number;
  expectedClosingAmount: number | null;
  salesFromDrawer: number | null;
  variance: number | null;
  nextOpeningAmount: number;
  openedAt: Date | null;
  closedAt: Date | null;
};

type ShiftLike = {
  id: string;
  openingAmount: Prisma.Decimal | number;
  closingAmount: Prisma.Decimal | number | null;
  reportedSales?: Prisma.Decimal | number | null;
  businessDate?: Date | null;
  openedAt: Date;
  closedAt: Date | null;
};

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function isLedgerShift(shift: ShiftLike) {
  return (
    shift.businessDate != null &&
    shift.businessDate.toISOString().slice(0, 10) >=
      WAITER_BALANCE_LEDGER_START_DATE
  );
}

export async function getActiveWaiterOrderingShift(
  waiterId: string,
  now: Date = new Date(),
) {
  return prisma.shift.findFirst({
    where: buildActiveWaiterShiftWhere(waiterId, now),
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
}

export function buildWaiterShiftSummary(
  shift: ShiftLike | null,
  posSales: number,
): WaiterShiftSummary {
  const roundedPosSales = roundCurrency(posSales);

  if (!shift) {
    return {
      shiftId: null,
      status: "not_opened",
      openingAmount: 0,
      closingAmount: null,
      totalSales: roundedPosSales,
      posSales: roundedPosSales,
      expectedClosingAmount: null,
      salesFromDrawer: null,
      variance: null,
      nextOpeningAmount: 0,
      openedAt: null,
      closedAt: null,
    };
  }

  const openingAmount = roundCurrency(Number(shift.openingAmount));
  const closingAmount =
    shift.closingAmount == null
      ? null
      : roundCurrency(Number(shift.closingAmount));
  const totalSales = roundCurrency(
    shift.reportedSales == null
      ? roundedPosSales
      : Number(shift.reportedSales),
  );

  if (isLedgerShift(shift)) {
    const result =
      closingAmount == null
        ? null
        : calculateWaiterBalance(openingAmount, totalSales, closingAmount);

    return {
      shiftId: shift.id,
      status: shift.closedAt ? "closed" : "open",
      openingAmount,
      closingAmount,
      totalSales,
      posSales: roundedPosSales,
      expectedClosingAmount: roundCurrency(
        Math.max(0, totalSales - openingAmount),
      ),
      salesFromDrawer: closingAmount,
      variance: result?.endingBalance ?? null,
      nextOpeningAmount: result?.endingBalance ?? openingAmount,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
    };
  }

  const expectedClosingAmount = roundCurrency(openingAmount + totalSales);
  const salesFromDrawer =
    closingAmount == null ? null : roundCurrency(closingAmount - openingAmount);
  const variance =
    salesFromDrawer == null
      ? null
      : roundCurrency(salesFromDrawer - totalSales);

  return {
    shiftId: shift.id,
    status: shift.closedAt ? "closed" : "open",
    openingAmount,
    closingAmount,
    totalSales,
    posSales: roundedPosSales,
    expectedClosingAmount,
    salesFromDrawer,
    variance,
    nextOpeningAmount: variance != null && variance < 0 ? variance : 0,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
  };
}

export async function getWaiterBusinessDayShiftSummary(
  waiterId: string,
  now: Date = new Date(),
) {
  const { start, end } = getCashierBusinessDayRange(now);
  const businessDateKey = getCurrentBusinessDateKey(now);
  const ledgerActive = isLedgerActive(now);

  const [shift, salesSummary] = await Promise.all([
    prisma.shift.findFirst({
      where: ledgerActive
        ? {
            userId: waiterId,
            businessDate: businessDateKeyToDatabaseDate(businessDateKey),
          }
        : {
            userId: waiterId,
            openedAt: { gte: start, lt: end },
          },
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        openingAmount: true,
        closingAmount: true,
        reportedSales: true,
        businessDate: true,
        openedAt: true,
        closedAt: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        waiterId,
        createdAt: { gte: start, lt: end },
      },
      _sum: { total: true },
    }),
  ]);

  return buildWaiterShiftSummary(shift, Number(salesSummary._sum.total ?? 0));
}

export async function getWaiterNextOpeningAmount(
  waiterId: string,
  now: Date = new Date(),
) {
  if (isLedgerActive(now)) {
    try {
      return await getWaiterOpeningBalanceForBusinessDate(
        waiterId,
        getCurrentBusinessDateKey(now),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("one-time opening balance")
      ) {
        return 0;
      }
      throw error;
    }
  }

  const latestClosedShift = await prisma.shift.findFirst({
    where: { userId: waiterId, closedAt: { not: null } },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      openingAmount: true,
      closingAmount: true,
      reportedSales: true,
      businessDate: true,
      openedAt: true,
      closedAt: true,
    },
  });

  if (!latestClosedShift) return 0;

  const { start, end } = getCashierBusinessDayRange(latestClosedShift.openedAt);
  const salesSummary = await prisma.order.aggregate({
    where: { waiterId, createdAt: { gte: start, lt: end } },
    _sum: { total: true },
  });

  return buildWaiterShiftSummary(
    latestClosedShift,
    Number(salesSummary._sum.total ?? 0),
  ).nextOpeningAmount;
}

export async function openWaiterBusinessDayShift(
  waiterId: string,
  requestedOpeningAmount: number,
  now: Date = new Date(),
) {
  const waiter = await prisma.user.findFirst({
    where: { id: waiterId, role: "WAITER", isActive: true },
    select: { id: true },
  });

  if (!waiter) throw new Error("Waiter not found.");

  const { start, end } = getCashierBusinessDayRange(now);
  const ledgerActive = isLedgerActive(now);
  const businessDateKey = getCurrentBusinessDateKey(now);
  const businessDate = ledgerActive
    ? businessDateKeyToDatabaseDate(businessDateKey)
    : null;
  const openingAmount = ledgerActive
    ? await getWaiterOpeningBalanceForBusinessDate(waiterId, businessDateKey)
    : roundCurrency(requestedOpeningAmount);
  const existingShift = await prisma.shift.findFirst({
    where: ledgerActive
      ? { userId: waiterId, businessDate }
      : { userId: waiterId, openedAt: { gte: start, lt: end } },
    orderBy: { openedAt: "desc" },
    select: { id: true, closedAt: true },
  });

  if (existingShift?.closedAt) {
    throw new Error("This waiter's balance has already been closed today.");
  }

  if (existingShift) {
    await prisma.shift.update({
      where: { id: existingShift.id },
      data: { openingAmount: toDecimal(openingAmount) },
    });
    return { mode: "updated" as const };
  }

  await prisma.shift.create({
    data: {
      userId: waiterId,
      openingAmount: toDecimal(openingAmount),
      ...(businessDate ? { businessDate } : {}),
    },
  });

  return { mode: "created" as const };
}

export async function closeWaiterBusinessDayShift(
  waiterId: string,
  closingAmount: number,
  now: Date = new Date(),
  settledByUserId?: string,
) {
  const { start, end } = getCashierBusinessDayRange(now);
  const ledgerActive = isLedgerActive(now);
  const businessDateKey = getCurrentBusinessDateKey(now);
  const openShift = await prisma.shift.findFirst({
    where: ledgerActive
      ? {
          userId: waiterId,
          businessDate: businessDateKeyToDatabaseDate(businessDateKey),
          closedAt: null,
        }
      : {
          userId: waiterId,
          openedAt: { gte: start, lt: end },
          closedAt: null,
        },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });

  if (!openShift) {
    throw new Error("There is no open balance for this waiter.");
  }

  const salesSummary = ledgerActive
    ? await prisma.order.aggregate({
        where: { waiterId, createdAt: { gte: start, lt: end } },
        _sum: { total: true },
      })
    : null;

  if (ledgerActive) {
    await saveWaiterSettlement({
      waiterId,
      businessDateKey,
      reportedSales: roundCurrency(Number(salesSummary?._sum.total ?? 0)),
      endDayAmount: roundCurrency(closingAmount),
      settledByUserId,
      now,
    });

    return getWaiterBusinessDayShiftSummary(waiterId, now);
  }

  await prisma.shift.update({
    where: { id: openShift.id },
    data: {
      closingAmount: toDecimal(roundCurrency(closingAmount)),
      closedAt: now,
      ...(ledgerActive
        ? {
            reportedSales: toDecimal(
              roundCurrency(Number(salesSummary?._sum.total ?? 0)),
            ),
            settledByUserId: settledByUserId ?? null,
          }
        : {}),
    },
  });

  return getWaiterBusinessDayShiftSummary(waiterId, now);
}

export async function reopenWaiterBusinessDayShift(
  waiterId: string,
  now: Date = new Date(),
) {
  const { start, end } = getCashierBusinessDayRange(now);
  const ledgerActive = isLedgerActive(now);

  if (ledgerActive) {
    await reopenWaiterSettlement({
      waiterId,
      businessDateKey: getCurrentBusinessDateKey(now),
      now,
    });

    return getWaiterBusinessDayShiftSummary(waiterId, now);
  }

  const closedShift = await prisma.shift.findFirst({
    where: {
      userId: waiterId,
      openedAt: { gte: start, lt: end },
      closedAt: { not: null },
    },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });

  if (!closedShift) {
    throw new Error("There is no closed balance for this waiter.");
  }

  await prisma.shift.update({
    where: { id: closedShift.id },
    data: {
      closingAmount: null,
      closedAt: null,
      ...(ledgerActive
        ? { reportedSales: null, settledByUserId: null }
        : {}),
    },
  });

  return getWaiterBusinessDayShiftSummary(waiterId, now);
}
