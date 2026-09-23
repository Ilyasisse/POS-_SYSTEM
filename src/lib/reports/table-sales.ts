type PaidOrder = {
  tableId: string | null;
  table: string | null;
  total: string;
};

export function summarizeTableSales(orders: PaidOrder[]) {
  const tables = new Map<
    string,
    { id: string; name: string; paidOrders: number; cents: bigint }
  >();
  let withoutTable = 0;
  for (const order of orders) {
    if (!order.tableId) {
      withoutTable += 1;
      continue;
    }
    const row = tables.get(order.tableId) ?? {
      id: order.tableId,
      name: order.table ?? "Unnamed table",
      paidOrders: 0,
      cents: BigInt(0),
    };
    row.paidOrders += 1;
    const [whole, fraction] = order.total.split(".");
    row.cents += BigInt(whole) * BigInt(100) + BigInt(fraction);
    tables.set(order.tableId, row);
  }
  return {
    withoutTable,
    tables: [...tables.values()]
      .sort((a, b) =>
        a.cents === b.cents
          ? b.paidOrders - a.paidOrders || a.name.localeCompare(b.name)
          : a.cents > b.cents
            ? -1
            : 1,
      )
      .map(({ cents, ...row }) => ({
        ...row,
        grossOrderValue: `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`,
      })),
  };
}
