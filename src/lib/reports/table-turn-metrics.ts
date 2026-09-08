export type TableTurnOrder = {
  id: string;
  type: string;
  createdAt: Date;
  closedAt: Date | null;
  tableCheck: {
    id: string;
    createdAt: Date;
    closedAt: Date | null;
  } | null;
};

export type TableTurnMetrics = {
  completedTableChecks: number;
  averageTableTurnMinutes: number | null;
};

const MINUTE_IN_MS = 60_000;

export function calculateTableTurnMetrics(
  orders: readonly TableTurnOrder[],
): TableTurnMetrics {
  const seenTableChecks = new Set<string>();
  const turnDurations: number[] = [];

  for (const order of orders) {
    if (order.type !== "DINE_IN") continue;

    const check = order.tableCheck;
    if (check) {
      if (seenTableChecks.has(check.id)) continue;
      seenTableChecks.add(check.id);

      const duration = check.closedAt
        ? check.closedAt.getTime() - check.createdAt.getTime()
        : -1;
      if (duration >= 0) turnDurations.push(duration);
      continue;
    }

    const duration = order.closedAt
      ? order.closedAt.getTime() - order.createdAt.getTime()
      : -1;
    if (duration >= 0) turnDurations.push(duration);
  }

  if (turnDurations.length === 0) {
    return {
      completedTableChecks: 0,
      averageTableTurnMinutes: null,
    };
  }

  const averageMilliseconds =
    turnDurations.reduce((total, duration) => total + duration, 0) /
    turnDurations.length;

  return {
    completedTableChecks: turnDurations.length,
    averageTableTurnMinutes:
      Math.round((averageMilliseconds / MINUTE_IN_MS) * 10) / 10,
  };
}
