export type VoidedOrder = {
  orderItems: { productId: string; productName: string; qty: number }[];
  salesAdjustments: { reason: string }[];
};

export function summarizeVoidInsights(orders: VoidedOrder[]) {
  const products = new Map<
    string,
    { id: string; name: string; orders: number; quantity: number }
  >();
  const reasons = new Map<string, number>();

  for (const order of orders) {
    const seenProducts = new Set<string>();
    for (const item of order.orderItems) {
      const row = products.get(item.productId) ?? {
        id: item.productId,
        name: item.productName,
        orders: 0,
        quantity: 0,
      };
      row.quantity += item.qty;
      if (!seenProducts.has(item.productId)) {
        row.orders += 1;
        seenProducts.add(item.productId);
      }
      products.set(item.productId, row);
    }
    for (const adjustment of order.salesAdjustments) {
      const reason = adjustment.reason.trim();
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  return {
    totalOrders: orders.length,
    products: [...products.values()].sort(
      (a, b) =>
        b.orders - a.orders ||
        b.quantity - a.quantity ||
        a.name.localeCompare(b.name),
    ),
    reasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}
