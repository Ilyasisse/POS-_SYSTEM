import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasCurrencyPrecision } from "@/lib/currency/amount-input";
import {
  assertLedgerBusinessDate,
  businessDateKeyToDatabaseDate,
  calculateWaiterBalance,
  getBusinessDayRangeForKey,
  isLedgerActive,
  roundCurrency,
  WAITER_BALANCE_LEDGER_START_DATE,
} from "@/lib/waiter/waiter-balance-calculations";

export {
  assertLedgerBusinessDate,
  businessDateKeyToDatabaseDate,
  calculateWaiterBalance,
  getBusinessDayRangeForKey,
  getCurrentBusinessDateKey,
  isLedgerActive,
  parseBusinessDateKey,
  roundCurrency,
  WAITER_BALANCE_LEDGER_START_DATE,
} from "@/lib/waiter/waiter-balance-calculations";

type LedgerDatabase = Prisma.TransactionClient | typeof prisma;

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function assertLedgerCurrencyAmount(
  value: number,
  message: string,
  options: { allowNegative?: boolean; requireNonPositive?: boolean } = {},
) {
  if (!Number.isFinite(value) || !hasCurrencyPrecision(value)) {
    throw new Error(message);
  }
  if (!options.allowNegative && value < 0) {
    throw new Error(message);
  }
  if (options.requireNonPositive && value > 0) {
    throw new Error(message);
  }
}

export async function getWaiterOpeningBalanceForBusinessDate(
  waiterId: string,
  businessDateKey: string,
  database: LedgerDatabase = prisma,
) {
  const initialization =
    await database.waiterBalanceInitialization.findUnique({
      where: { waiterId },
      select: { openingBalance: true },
    });

  if (!initialization) {
    throw new Error("This waiter needs a one-time opening balance.");
  }

  const priorSettlements = await database.shift.findMany({
    where: {
      userId: waiterId,
      businessDate: {
        gte: businessDateKeyToDatabaseDate(WAITER_BALANCE_LEDGER_START_DATE),
        lt: businessDateKeyToDatabaseDate(businessDateKey),
      },
      closedAt: { not: null },
      closingAmount: { not: null },
      reportedSales: { not: null },
    },
    orderBy: { businessDate: "asc" },
    select: {
      closingAmount: true,
      reportedSales: true,
    },
  });

  return priorSettlements.reduce(
    (balance, settlement) =>
      calculateWaiterBalance(
        balance,
        Number(settlement.reportedSales),
        Number(settlement.closingAmount),
      ).endingBalance,
    roundCurrency(Number(initialization.openingBalance)),
  );
}

export async function initializeWaiterBalance(input: {
  waiterId: string;
  openingBalance: number;
  createdByUserId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (!isLedgerActive(now)) {
    throw new Error("Waiter balance initialization opens on July 1, 2026.");
  }

  const openingBalance = roundCurrency(input.openingBalance);
  try {
    assertLedgerCurrencyAmount(input.openingBalance, "Opening balance must be zero or a negative amount.", {
      allowNegative: true,
      requireNonPositive: true,
    });
  } catch {
    throw new Error("Opening balance must be zero or a negative amount.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const waiter = await tx.user.findFirst({
        where: { id: input.waiterId, role: "WAITER" },
        select: { id: true, isActive: true },
      });

      if (!waiter) throw new Error("Waiter not found.");
      if (!waiter.isActive) {
        throw new Error("Inactive waiters cannot receive a new opening balance.");
      }

      const existing = await tx.waiterBalanceInitialization.findUnique({
        where: { waiterId: input.waiterId },
        select: { id: true },
      });

      if (existing) {
        throw new Error("This waiter's opening balance is already locked.");
      }

      return tx.waiterBalanceInitialization.create({
        data: {
          waiterId: input.waiterId,
          effectiveBusinessDate: businessDateKeyToDatabaseDate(
            WAITER_BALANCE_LEDGER_START_DATE,
          ),
          openingBalance: toDecimal(openingBalance),
          createdByUserId: input.createdByUserId,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("This waiter's opening balance is already locked.");
    }
    throw error;
  }
}

async function recalculateFollowingBalances(
  tx: Prisma.TransactionClient,
  waiterId: string,
  afterBusinessDateKey: string,
  startingBalance: number,
) {
  const laterShifts = await tx.shift.findMany({
    where: {
      userId: waiterId,
      businessDate: {
        gt: businessDateKeyToDatabaseDate(afterBusinessDateKey),
      },
    },
    orderBy: { businessDate: "asc" },
    select: {
      id: true,
      closingAmount: true,
      reportedSales: true,
      closedAt: true,
    },
  });

  let carriedBalance = startingBalance;

  for (const shift of laterShifts) {
    await tx.shift.update({
      where: { id: shift.id },
      data: { openingAmount: toDecimal(carriedBalance) },
    });

    if (
      shift.closedAt &&
      shift.closingAmount != null &&
      shift.reportedSales != null
    ) {
      carriedBalance = calculateWaiterBalance(
        carriedBalance,
        Number(shift.reportedSales),
        Number(shift.closingAmount),
      ).endingBalance;
    }
  }
}

export async function saveWaiterSettlement(input: {
  waiterId: string;
  businessDateKey: string;
  reportedSales: number;
  endDayAmount: number;
  settledByUserId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const businessDateKey = assertLedgerBusinessDate(
    input.businessDateKey,
    now,
  );
  const reportedSales = roundCurrency(input.reportedSales);
  const endDayAmount = roundCurrency(input.endDayAmount);

  if (!hasCurrencyPrecision(input.reportedSales)) {
    throw new Error("Reported sales must be zero or greater.");
  }
  if (!Number.isFinite(reportedSales) || reportedSales < 0) {
    throw new Error("Reported sales must be zero or greater.");
  }
  if (!hasCurrencyPrecision(input.endDayAmount)) {
    throw new Error("End-day amount must be zero or greater.");
  }
  if (!Number.isFinite(endDayAmount) || endDayAmount < 0) {
    throw new Error("End-day amount must be zero or greater.");
  }

  return prisma.$transaction(
    async (tx) => {
      const waiter = await tx.user.findFirst({
        where: { id: input.waiterId, role: "WAITER" },
        select: { id: true, isActive: true },
      });

      if (!waiter) throw new Error("Waiter not found.");

      const businessDate = businessDateKeyToDatabaseDate(businessDateKey);
      const existingShift = await tx.shift.findUnique({
        where: {
          userId_businessDate: {
            userId: input.waiterId,
            businessDate,
          },
        },
        select: { id: true, closedAt: true },
      });
      if (!waiter.isActive && !existingShift?.closedAt) {
        throw new Error(
          "Inactive waiters can only correct closed historical settlements.",
        );
      }
      const openingBalance = await getWaiterOpeningBalanceForBusinessDate(
        input.waiterId,
        businessDateKey,
        tx,
      );
      const { start } = getBusinessDayRangeForKey(businessDateKey);
      let shift;

      if (existingShift) {
        shift = await tx.shift.update({
          where: { id: existingShift.id },
          data: {
            openingAmount: toDecimal(openingBalance),
            reportedSales: toDecimal(reportedSales),
            closingAmount: toDecimal(endDayAmount),
            closedAt: existingShift.closedAt ?? now,
            settledByUserId: input.settledByUserId ?? null,
          },
        });
      } else {
        try {
          shift = await tx.shift.create({
            data: {
              userId: input.waiterId,
              businessDate,
              openedAt: start,
              openingAmount: toDecimal(openingBalance),
              reportedSales: toDecimal(reportedSales),
              closingAmount: toDecimal(endDayAmount),
              closedAt: now,
              settledByUserId: input.settledByUserId ?? null,
            },
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;

          shift = await tx.shift.update({
            where: {
              userId_businessDate: {
                userId: input.waiterId,
                businessDate,
              },
            },
            data: {
              openingAmount: toDecimal(openingBalance),
              reportedSales: toDecimal(reportedSales),
              closingAmount: toDecimal(endDayAmount),
              closedAt: now,
              settledByUserId: input.settledByUserId ?? null,
            },
          });
        }
      }

      const result = calculateWaiterBalance(
        openingBalance,
        reportedSales,
        endDayAmount,
      );

      await recalculateFollowingBalances(
        tx,
        input.waiterId,
        businessDateKey,
        result.endingBalance,
      );

      return { shift, openingBalance, ...result };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function reopenWaiterSettlement(input: {
  waiterId: string;
  businessDateKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const businessDateKey = assertLedgerBusinessDate(
    input.businessDateKey,
    now,
  );

  return prisma.$transaction(
    async (tx) => {
      const businessDate = businessDateKeyToDatabaseDate(businessDateKey);
      const openingBalance = await getWaiterOpeningBalanceForBusinessDate(
        input.waiterId,
        businessDateKey,
        tx,
      );

      const shift = await tx.shift.findUnique({
        where: {
          userId_businessDate: {
            userId: input.waiterId,
            businessDate,
          },
        },
        select: { id: true, closedAt: true },
      });

      if (!shift?.closedAt) {
        throw new Error("There is no closed balance for this waiter.");
      }

      const reopenedShift = await tx.shift.update({
        where: { id: shift.id },
        data: {
          openingAmount: toDecimal(openingBalance),
          closingAmount: null,
          closedAt: null,
          reportedSales: null,
          settledByUserId: null,
        },
      });

      await recalculateFollowingBalances(
        tx,
        input.waiterId,
        businessDateKey,
        openingBalance,
      );

      return { shift: reopenedShift, openingBalance };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
