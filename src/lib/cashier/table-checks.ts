import type { Prisma } from "@prisma/client";

type TableCheckIdentityOrder = {
  orderNumber: number;
  tableCheckRound?: number | null;
  tableCheck?: { checkNumber: number } | null;
};

export function resolveTableCheckIdentity(order: TableCheckIdentityOrder) {
  return {
    orderNumber: order.tableCheck?.checkNumber ?? order.orderNumber,
    ticketNumber: order.orderNumber,
    roundNumber: order.tableCheckRound ?? 1,
  };
}

export type CashierOpenOrderRound = TableCheckIdentityOrder & {
  id: string;
  tableCheckId: string | null;
  total: number;
  createdAt: Date;
  cashierName: string | null;
  items: Array<{
    id: string;
    productName: string;
    qty: number;
  }>;
};

export type CashierOpenCheck = ReturnType<typeof resolveTableCheckIdentity> & {
  key: string;
  total: number;
  rounds: CashierOpenOrderRound[];
};

export function groupCashierOpenOrders(
  orders: readonly CashierOpenOrderRound[],
): CashierOpenCheck[] {
  const checks = new Map<string, CashierOpenCheck>();

  for (const order of orders) {
    const identity = resolveTableCheckIdentity(order);
    const key = order.tableCheckId ?? `legacy:${order.id}`;
    const existing = checks.get(key);

    if (existing) {
      existing.total += order.total;
      existing.rounds.push(order);
      continue;
    }

    checks.set(key, {
      key,
      ...identity,
      total: order.total,
      rounds: [order],
    });
  }

  return Array.from(checks.values()).map((check) => ({
    ...check,
    rounds: check.rounds.sort(
      (left, right) =>
        (left.tableCheckRound ?? 1) - (right.tableCheckRound ?? 1),
    ),
  }));
}

export async function closeSettledTableChecks(
  tx: Pick<Prisma.TransactionClient, "tableCheck" | "table">,
  tableCheckIds: readonly (string | null | undefined)[],
  closedAt: Date,
) {
  const ids = [
    ...new Set(tableCheckIds.filter((id): id is string => Boolean(id))),
  ];

  if (ids.length === 0) return;

  await tx.tableCheck.updateMany({
    where: {
      id: { in: ids },
      closedAt: null,
      orders: { none: { status: "OPEN" } },
    },
    data: { closedAt },
  });

  // Mark a table for cleaning only after every dine-in order on it has closed.
  // A partial bill payment leaves the table occupied and does not reset its state.
  const settledChecks = await tx.tableCheck.findMany({
    where: { id: { in: ids }, closedAt: { not: null } },
    select: { tableId: true },
  });
  if (settledChecks.length) {
    await tx.table.updateMany({
      where: {
        id: { in: [...new Set(settledChecks.map((check) => check.tableId))] },
        needsCleaning: false,
        orders: { none: { status: "OPEN", type: "DINE_IN" } },
      },
      data: { needsCleaning: true },
    });
  }
}
