import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  businessDateKeyToDatabaseDate,
  getBusinessDayRangeForKey,
  getWaiterOpeningBalanceForBusinessDate,
  recalculateFollowingBalances,
  shiftBusinessDateKey,
  WAITER_BALANCE_LEDGER_START_DATE,
} from "@/lib/waiter/waiter-balance-ledger";

type Database = Prisma.TransactionClient | typeof prisma;

export type SettlementDateShiftPreview = {
  sourceBusinessDateKey: string;
  targetBusinessDateKey: string;
  candidateShiftIds: string[];
  incompleteShiftIds: string[];
  conflictingShiftIds: string[];
  applied: boolean;
};

async function inspect(database: Database, sourceBusinessDateKey: string) {
  const targetBusinessDateKey = shiftBusinessDateKey(sourceBusinessDateKey, -1);
  if (targetBusinessDateKey < WAITER_BALANCE_LEDGER_START_DATE) {
    throw new Error("Waiter settlements cannot be moved before July 1, 2026.");
  }
  const source = await database.shift.findMany({
    where: { businessDate: businessDateKeyToDatabaseDate(sourceBusinessDateKey), waiter: { role: "WAITER" } },
    select: { id: true, userId: true, closedAt: true, closingAmount: true, reportedSales: true },
  });
  const incompleteShiftIds = source.filter((shift) => !shift.closedAt || shift.closingAmount == null || shift.reportedSales == null).map((shift) => shift.id);
  const candidates = source.filter((shift) => shift.closedAt && shift.closingAmount != null && shift.reportedSales != null);
  const conflicts = candidates.length ? await database.shift.findMany({
    where: { userId: { in: candidates.map((shift) => shift.userId) }, businessDate: businessDateKeyToDatabaseDate(targetBusinessDateKey) },
    select: { id: true },
  }) : [];
  return { sourceBusinessDateKey, targetBusinessDateKey, candidates, incompleteShiftIds, conflictingShiftIds: conflicts.map((shift) => shift.id) };
}

export async function shiftWaiterSettlementsBackOneDay(input: { sourceBusinessDateKey: string; apply?: boolean }): Promise<SettlementDateShiftPreview> {
  const run = async (database: Database) => {
    const result = await inspect(database, input.sourceBusinessDateKey);
    if (!input.apply || result.incompleteShiftIds.length || result.conflictingShiftIds.length) {
      return { ...result, candidateShiftIds: result.candidates.map((shift) => shift.id), applied: false };
    }
    const { start } = getBusinessDayRangeForKey(result.targetBusinessDateKey);
    for (const shift of result.candidates) {
      const openingBalance = await getWaiterOpeningBalanceForBusinessDate(shift.userId, result.targetBusinessDateKey, database);
      await database.shift.update({ where: { id: shift.id }, data: { businessDate: businessDateKeyToDatabaseDate(result.targetBusinessDateKey), openedAt: start, openingAmount: new Prisma.Decimal(openingBalance) } });
      await recalculateFollowingBalances(database as Prisma.TransactionClient, shift.userId, result.targetBusinessDateKey, openingBalance);
    }
    return { ...result, candidateShiftIds: result.candidates.map((shift) => shift.id), applied: true };
  };
  return input.apply ? prisma.$transaction((tx) => run(tx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }) : run(prisma);
}
