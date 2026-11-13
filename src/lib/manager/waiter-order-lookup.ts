type WaiterOrderSummary = {
  orderNumber: number;
  table: { name: string } | null;
};

export function findWaiterOrders<T extends WaiterOrderSummary>(
  orders: readonly T[],
  search: string,
): T[] {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return [...orders];

  const orderNumber = /^#?[1-9]\d*$/.test(term)
    ? Number(term.replace(/^#/, ""))
    : null;
  return orders.filter(
    (order) =>
      order.table?.name.toLocaleLowerCase().includes(term) ||
      (orderNumber !== null && order.orderNumber === orderNumber),
  );
}
