import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCashierBusinessDayRange } from "@/lib/cashier-business-day";

export type WaiterShiftSummary = {
  shiftId: string | null;
  status: "not_opened" | "open" | "closed";
  openingAmount: number;
  closingAmount: number | null;
  totalSales: number;
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
  openedAt: Date;
  closedAt: Date | null;
};

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildWaiterShiftSummary(
  shift: ShiftLike | null,
  totalSales: number,
): WaiterShiftSummary {
  const roundedSales = roundCurrency(totalSales);

  if (!shift) {
    return {
      shiftId: null,
      status: "not_opened",
      openingAmount: 0,
      closingAmount: null,
      totalSales: roundedSales,
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
  const expectedClosingAmount = roundCurrency(openingAmount + roundedSales);
  const salesFromDrawer =
    closingAmount == null ? null : roundCurrency(closingAmount - openingAmount);
  const variance =
    salesFromDrawer == null
      ? null
      : roundCurrency(salesFromDrawer - roundedSales);

  return {
    shiftId: shift.id,
    status: shift.closedAt ? "closed" : "open",
    openingAmount,
    closingAmount,
    totalSales: roundedSales,
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

  const [shift, salesSummary] = await Promise.all([
    prisma.shift.findFirst({
      where: {
        userId: waiterId,
        openedAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        openedAt: "desc",
      },
      select: {
        id: true,
        openingAmount: true,
        closingAmount: true,
        openedAt: true,
        closedAt: true,
      },
    }),
    prisma.order.aggregate({
      where: {
        waiterId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      _sum: {
        total: true,
      },
    }),
  ]);

  return buildWaiterShiftSummary(shift, Number(salesSummary._sum.total ?? 0));
}

export async function getWaiterNextOpeningAmount(waiterId: string) {
  const latestClosedShift = await prisma.shift.findFirst({
    where: {
      userId: waiterId,
      closedAt: {
        not: null,
      },
    },
    orderBy: {
      openedAt: "desc",
    },
    select: {
      id: true,
      openingAmount: true,
      closingAmount: true,
      openedAt: true,
      closedAt: true,
    },
  });

  if (!latestClosedShift) {
    return 0;
  }

  const { start, end } = getCashierBusinessDayRange(latestClosedShift.openedAt);
  const salesSummary = await prisma.order.aggregate({
    where: {
      waiterId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    _sum: {
      total: true,
    },
  });

  return buildWaiterShiftSummary(
    latestClosedShift,
    Number(salesSummary._sum.total ?? 0),
  ).nextOpeningAmount;
}

export async function openWaiterBusinessDayShift(
  waiterId: string,
  openingAmount: number,
  now: Date = new Date(),
) {
  const waiter = await prisma.user.findFirst({
    where: {
      id: waiterId,
      role: "WAITER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!waiter) {
    throw new Error("Waiter not found.");
  }

  const { start, end } = getCashierBusinessDayRange(now);
  const roundedOpeningAmount = roundCurrency(openingAmount);
  const existingShift = await prisma.shift.findFirst({
    where: {
      userId: waiterId,
      openedAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: {
      openedAt: "desc",
    },
    select: {
      id: true,
      closedAt: true,
    },
  });

  if (existingShift?.closedAt) {
    throw new Error("This waiter's balance has already been closed today.");
  }

  if (existingShift) {
    await prisma.shift.update({
      where: {
        id: existingShift.id,
      },
      data: {
        openingAmount: toDecimal(roundedOpeningAmount),
      },
    });

    return { mode: "updated" as const };
  }

  await prisma.shift.create({
    data: {
      userId: waiterId,
      openingAmount: toDecimal(roundedOpeningAmount),
    },
  });

  return { mode: "created" as const };
}

export async function closeWaiterBusinessDayShift(
  waiterId: string,
  closingAmount: number,
  now: Date = new Date(),
) {
  const { start, end } = getCashierBusinessDayRange(now);
  const roundedClosingAmount = roundCurrency(closingAmount);
  const openShift = await prisma.shift.findFirst({
    where: {
      userId: waiterId,
      openedAt: {
        gte: start,
        lt: end,
      },
      closedAt: null,
    },
    orderBy: {
      openedAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!openShift) {
    throw new Error("There is no open balance for this waiter.");
  }

  await prisma.shift.update({
    where: {
      id: openShift.id,
    },
    data: {
      closingAmount: toDecimal(roundedClosingAmount),
      closedAt: now,
    },
  });

  return getWaiterBusinessDayShiftSummary(waiterId, now);
}

export async function reopenWaiterBusinessDayShift(
  waiterId: string,
  now: Date = new Date(),
) {
  const { start, end } = getCashierBusinessDayRange(now);
  const closedShift = await prisma.shift.findFirst({
    where: {
      userId: waiterId,
      openedAt: {
        gte: start,
        lt: end,
      },
      closedAt: {
        not: null,
      },
    },
    orderBy: {
      openedAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!closedShift) {
    throw new Error("There is no closed balance for this waiter.");
  }

  await prisma.shift.update({
    where: {
      id: closedShift.id,
    },
    data: {
      closingAmount: null,
      closedAt: null,
    },
  });

  return getWaiterBusinessDayShiftSummary(waiterId, now);
}
