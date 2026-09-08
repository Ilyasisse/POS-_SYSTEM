type MoneyValue = number | string | { toString(): string };
type StaffIdentity = { id: string; fullName: string } | null;
type StaffSalesOrder = {
  waiter: StaffIdentity;
  cashier: StaffIdentity;
  orderItems: Array<{ lineTotal: MoneyValue }>;
  salesAdjustments: Array<{ amount: MoneyValue }>;
};

function cents(value: MoneyValue) {
  return Math.round(Number(value.toString()) * 100);
}

function money(value: number) {
  return (value / 100).toFixed(2);
}

export function calculateStaffSalesMetrics(
  orders: readonly StaffSalesOrder[],
) {
  const rows = new Map<
    string,
    {
      staffId: string | null;
      staffName: string;
      attribution: "WAITER" | "CASHIER" | "UNASSIGNED";
      orderCount: number;
      grossCents: number;
      reductionCents: number;
    }
  >();

  for (const order of orders) {
    const staff = order.waiter ?? order.cashier;
    const attribution = order.waiter
      ? "WAITER"
      : order.cashier
        ? "CASHIER"
        : "UNASSIGNED";
    const key = staff?.id ?? "unassigned";
    const row = rows.get(key) ?? {
      staffId: staff?.id ?? null,
      staffName: staff?.fullName ?? "Unassigned",
      attribution,
      orderCount: 0,
      grossCents: 0,
      reductionCents: 0,
    };

    row.orderCount += 1;
    row.grossCents += order.orderItems.reduce(
      (sum, item) => sum + cents(item.lineTotal),
      0,
    );
    row.reductionCents += order.salesAdjustments.reduce(
      (sum, adjustment) => sum + cents(adjustment.amount),
      0,
    );
    rows.set(key, row);
  }

  return [...rows.values()]
    .map((row) => {
      const netCents = row.grossCents - row.reductionCents;
      return {
        staffId: row.staffId,
        staffName: row.staffName,
        attribution: row.attribution,
        orderCount: row.orderCount,
        grossSales: money(row.grossCents),
        reductions: money(row.reductionCents),
        netSales: money(netCents),
        averageOrderValue: money(Math.round(netCents / row.orderCount)),
      };
    })
    .sort(
      (left, right) =>
        Number(right.netSales) - Number(left.netSales) ||
        left.staffName.localeCompare(right.staffName),
    );
}
