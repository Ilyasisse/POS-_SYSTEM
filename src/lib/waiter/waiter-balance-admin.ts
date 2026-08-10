import { prisma } from "@/lib/prisma";
import {
  buildWaiterBalanceWaiterWhere,
  getWaiterBalanceCapabilities,
} from "@/lib/waiter/waiter-balance-access";
import {
  assertLedgerBusinessDate,
  businessDateKeyToDatabaseDate,
  calculateWaiterBalance,
  getBusinessDayRangeForKey,
  roundCurrency,
  WAITER_BALANCE_LEDGER_START_DATE,
} from "@/lib/waiter/waiter-balance-ledger";

export type WaiterBalanceAdminRow = {
  waiterId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  canInitialize: boolean;
  canEditSettlement: boolean;
  initialization: {
    openingBalance: number;
    createdAt: Date;
  } | null;
  shiftId: string | null;
  status: "uninitialized" | "not_recorded" | "open" | "closed";
  openingBalance: number | null;
  reportedSales: number | null;
  posSales: number;
  endDayAmount: number | null;
  dailyDifference: number | null;
  endingBalance: number | null;
  settledByName: string | null;
  updatedAt: Date | null;
};

export async function getWaiterBalanceAdminRows(
  businessDateKey: string,
  optionsOrNow: { includeInactive?: boolean; now?: Date } | Date = {},
) {
  const options =
    optionsOrNow instanceof Date ? { now: optionsOrNow } : optionsOrNow;
  const includeInactive = options.includeInactive ?? false;
  const now = options.now ?? new Date();
  const selectedDate = assertLedgerBusinessDate(businessDateKey, now);
  const selectedDatabaseDate = businessDateKeyToDatabaseDate(selectedDate);
  const { start, end } = getBusinessDayRangeForKey(selectedDate);

  const waiters = await prisma.user.findMany({
    where: buildWaiterBalanceWaiterWhere(includeInactive),
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      waiterBalanceInitialization: {
        select: { openingBalance: true, createdAt: true },
      },
    },
    orderBy: { fullName: "asc" },
  });
  const waiterIds = waiters.map((waiter) => waiter.id);

  if (waiterIds.length === 0) return [] as WaiterBalanceAdminRow[];

  const [priorSettlements, selectedShifts, posSalesRows] = await Promise.all([
    prisma.shift.findMany({
      where: {
        userId: { in: waiterIds },
        businessDate: {
          gte: businessDateKeyToDatabaseDate(
            WAITER_BALANCE_LEDGER_START_DATE,
          ),
          lt: selectedDatabaseDate,
        },
        closedAt: { not: null },
        closingAmount: { not: null },
        reportedSales: { not: null },
      },
      orderBy: [{ userId: "asc" }, { businessDate: "asc" }],
      select: {
        userId: true,
        closingAmount: true,
        reportedSales: true,
      },
    }),
    prisma.shift.findMany({
      where: {
        userId: { in: waiterIds },
        businessDate: selectedDatabaseDate,
      },
      select: {
        id: true,
        userId: true,
        openingAmount: true,
        reportedSales: true,
        closingAmount: true,
        closedAt: true,
        updatedAt: true,
        settledBy: { select: { fullName: true } },
      },
    }),
    prisma.order.groupBy({
      by: ["waiterId"],
      where: {
        waiterId: { in: waiterIds },
        createdAt: { gte: start, lt: end },
      },
      _sum: { total: true },
    }),
  ]);

  const selectedShiftByWaiter = new Map(
    selectedShifts.map((shift) => [shift.userId, shift]),
  );
  const posSalesByWaiter = new Map(
    posSalesRows.map((row) => [
      row.waiterId ?? "",
      roundCurrency(Number(row._sum.total ?? 0)),
    ]),
  );

  return waiters.map((waiter): WaiterBalanceAdminRow => {
    const initialization = waiter.waiterBalanceInitialization;
    const shift = selectedShiftByWaiter.get(waiter.id) ?? null;
    const openingBalance = initialization
      ? priorSettlements
          .filter((settlement) => settlement.userId === waiter.id)
          .reduce(
            (balance, settlement) =>
              calculateWaiterBalance(
                balance,
                Number(settlement.reportedSales),
                Number(settlement.closingAmount),
              ).endingBalance,
            roundCurrency(Number(initialization.openingBalance)),
          )
      : null;
    const reportedSales =
      shift?.reportedSales == null
        ? null
        : roundCurrency(Number(shift.reportedSales));
    const endDayAmount =
      shift?.closingAmount == null
        ? null
        : roundCurrency(Number(shift.closingAmount));
    const calculation =
      openingBalance != null &&
      reportedSales != null &&
      endDayAmount != null
        ? calculateWaiterBalance(
            openingBalance,
            reportedSales,
            endDayAmount,
          )
        : null;
    const capabilities = getWaiterBalanceCapabilities({
      isActive: waiter.isActive,
      hasInitialization: initialization != null,
      hasClosedShift: shift?.closedAt != null,
    });

    return {
      waiterId: waiter.id,
      fullName: waiter.fullName,
      email: waiter.email,
      isActive: waiter.isActive,
      canInitialize: capabilities.canInitialize,
      canEditSettlement: capabilities.canEditSettlement,
      initialization: initialization
        ? {
            openingBalance: roundCurrency(
              Number(initialization.openingBalance),
            ),
            createdAt: initialization.createdAt,
          }
        : null,
      shiftId: shift?.id ?? null,
      status: !initialization
        ? "uninitialized"
        : !shift
          ? "not_recorded"
          : shift.closedAt
            ? "closed"
            : "open",
      openingBalance,
      reportedSales,
      posSales: posSalesByWaiter.get(waiter.id) ?? 0,
      endDayAmount,
      dailyDifference: calculation?.dailyDifference ?? null,
      endingBalance: calculation?.endingBalance ?? null,
      settledByName: shift?.settledBy?.fullName ?? null,
      updatedAt: shift?.updatedAt ?? null,
    };
  });
}

export async function getWaiterInitializationRowsWithInactive(
  includeInactive = false,
) {
  return prisma.user.findMany({
    where: buildWaiterBalanceWaiterWhere(includeInactive),
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      waiterBalanceInitialization: {
        select: {
          openingBalance: true,
          effectiveBusinessDate: true,
          createdAt: true,
          createdBy: { select: { fullName: true } },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });
}
