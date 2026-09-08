export function countDineInCovers(
  orders: Array<{
    id: string;
    type: string;
    tableCheckId: string | null;
    guestCount: number | null;
  }>,
) {
  const countedChecks = new Set<string>();
  let covers = 0;

  for (const order of orders) {
    if (order.type !== "DINE_IN") continue;

    if (!order.tableCheckId) {
      covers += 1;
      continue;
    }

    if (countedChecks.has(order.tableCheckId)) continue;
    countedChecks.add(order.tableCheckId);
    covers += order.guestCount ?? 1;
  }

  return covers;
}
