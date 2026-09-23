type PaidOrder = {
  waiterId: string | null;
  waiter: string | null;
  total: string;
};

export function rankWaiterSales(orders: PaidOrder[]) {
  const rows = new Map<
    string,
    { id: string; name: string; orders: number; cents: bigint }
  >();
  for (const order of orders) {
    const id = order.waiterId ?? "unassigned";
    const row = rows.get(id) ?? {
      id,
      name: order.waiter ?? "Unassigned",
      orders: 0,
      cents: BigInt(0),
    };
    row.orders += 1;
    const [whole, fractional] = order.total.split(".");
    row.cents += BigInt(whole) * BigInt(100) + BigInt(fractional);
    rows.set(id, row);
  }
  return [...rows.values()]
    .sort((a, b) =>
      a.cents === b.cents
        ? b.orders - a.orders || a.name.localeCompare(b.name)
        : a.cents > b.cents
          ? -1
          : 1,
    )
    .map(({ cents, ...row }) => ({
      ...row,
      grossOrderValue: `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`,
    }));
}
