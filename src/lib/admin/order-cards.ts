export type OrderCardRound = {
  id: string;
  orderNumber: number;
  tableCheckId: string | null;
  tableCheckRound: number | null;
  checkNumber: number | null;
  tableName: string | null;
  type: "DINE_IN" | "TAKEOUT" | "DELIVERY";
  status: "OPEN" | "PAID" | "CANCELLED";
  total: number;
  createdAt: Date;
  cashierName: string | null;
  waiterName: string | null;
  customerName: string | null;
  itemCount: number;
};

// A check identifies a table visit. Never combine separate visits by table ID.
export function groupOrderCards(orders: readonly OrderCardRound[]) {
  const groups = new Map<string, OrderCardRound[]>();
  for (const order of orders) {
    const key = order.tableCheckId ?? `order:${order.id}`;
    const rounds = groups.get(key);
    if (rounds) rounds.push(order);
    else groups.set(key, [order]);
  }

  return Array.from(groups, ([key, orders]) => {
    const rounds = [...orders].sort(
      (a, b) =>
        (a.tableCheckRound ?? 1) - (b.tableCheckRound ?? 1) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const latest = rounds[rounds.length - 1]!;
    const activeRounds = rounds.filter((round) => round.status !== "CANCELLED");
    return {
      key,
      orderNumber: latest.checkNumber ?? latest.orderNumber,
      latest,
      rounds,
      total: activeRounds.reduce((sum, round) => sum + round.total, 0),
      status: activeRounds.length === 0
        ? "CANCELLED"
        : activeRounds.some((round) => round.status === "OPEN")
          ? "OPEN"
          : "PAID",
    };
  });
}
