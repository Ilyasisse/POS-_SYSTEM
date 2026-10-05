export const ORDER_TYPES = ["DINE_IN", "TAKEOUT", "DELIVERY"] as const;
export type ReportOrderType = (typeof ORDER_TYPES)[number];

type MoneyValue = number | string | { toString(): string };
type OrderTypeMetricInput = {
  type: ReportOrderType;
  orderItems: Array<{ lineTotal: MoneyValue }>;
  salesAdjustments: Array<{
    type: "DISCOUNT" | "REFUND" | "COMPLIMENTARY" | "STAFF_MEAL" | string;
    amount: MoneyValue;
  }>;
};

const labels: Record<ReportOrderType, string> = {
  DINE_IN: "Dine-in",
  TAKEOUT: "Takeaway",
  DELIVERY: "Delivery",
};

function cents(value: MoneyValue) {
  return Math.round(Number(value.toString()) * 100);
}

function money(value: number) {
  return (value / 100).toFixed(2);
}

export function calculateOrderTypeMetrics(
  orders: readonly OrderTypeMetricInput[],
) {
  const rows = new Map(
    ORDER_TYPES.map((type) => [
      type,
      { type, label: labels[type], orderCount: 0, grossCents: 0, reductionCents: 0 },
    ]),
  );

  for (const order of orders) {
    const row = rows.get(order.type);
    if (!row) continue;
    row.orderCount += 1;
    row.grossCents += order.orderItems.reduce(
      (sum, item) => sum + cents(item.lineTotal),
      0,
    );
    row.reductionCents += order.salesAdjustments.reduce(
      (sum, adjustment) => sum + cents(adjustment.amount),
      0,
    );
  }

  const totalNetCents = [...rows.values()].reduce(
    (sum, row) => sum + row.grossCents - row.reductionCents,
    0,
  );

  return [...rows.values()].map((row) => {
    const netCents = row.grossCents - row.reductionCents;
    return {
      type: row.type,
      label: row.label,
      orderCount: row.orderCount,
      grossSales: money(row.grossCents),
      reductions: money(row.reductionCents),
      netSales: money(netCents),
      averageOrderValue:
        row.orderCount > 0 ? money(Math.round(netCents / row.orderCount)) : null,
      netSalesSharePercent:
        totalNetCents > 0
          ? Math.round((netCents / totalNetCents) * 1_000) / 10
          : 0,
    };
  });
}
