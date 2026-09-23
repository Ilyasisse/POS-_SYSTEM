import { Prisma } from "@prisma/client";

type DiscountOrder = {
  id: string;
  orderItems: readonly { id: string; productId: string; productName: string }[];
  salesAdjustments: readonly {
    type: string;
    orderItemId: string | null;
    amount: Prisma.Decimal | string;
  }[];
};

/** Attribute item discounts to products; never guess a product for a whole-order discount. */
export function summarizeProductDiscounts(orders: readonly DiscountOrder[]) {
  const products = new Map<string, {
    productId: string;
    name: string;
    adjustments: number;
    orderIds: Set<string>;
    amount: Prisma.Decimal;
  }>();
  const soldOrders = new Map<string, Set<string>>();
  const unattributedOrderIds = new Set<string>();
  let unattributedAdjustments = 0;
  let unattributedAmount = new Prisma.Decimal(0);

  for (const order of orders) {
    const items = new Map(order.orderItems.map((item) => [item.id, item]));
    for (const item of order.orderItems) {
      const ids = soldOrders.get(item.productId) ?? new Set<string>();
      ids.add(order.id);
      soldOrders.set(item.productId, ids);
    }
    for (const adjustment of order.salesAdjustments) {
      if (adjustment.type !== "DISCOUNT") continue;
      const item = adjustment.orderItemId ? items.get(adjustment.orderItemId) : null;
      if (!item) {
        unattributedOrderIds.add(order.id);
        unattributedAdjustments += 1;
        unattributedAmount = unattributedAmount.plus(adjustment.amount);
        continue;
      }

      const row = products.get(item.productId) ?? {
        productId: item.productId,
        name: item.productName,
        adjustments: 0,
        orderIds: new Set<string>(),
        amount: new Prisma.Decimal(0),
      };
      row.adjustments += 1;
      row.orderIds.add(order.id);
      row.amount = row.amount.plus(adjustment.amount);
      products.set(item.productId, row);
    }
  }

  return {
    products: [...products.values()].map((row) => ({
      productId: row.productId,
      name: row.name,
      adjustments: row.adjustments,
      orders: row.orderIds.size,
      soldOrders: soldOrders.get(row.productId)?.size ?? 0,
      discountedOrderRate: new Prisma.Decimal(row.orderIds.size)
        .div(soldOrders.get(row.productId)?.size ?? 1).times(100).toFixed(1),
      amount: row.amount.toFixed(2),
    })).sort((a, b) => b.orders - a.orders || b.adjustments - a.adjustments || a.name.localeCompare(b.name)),
    unattributed: {
      adjustments: unattributedAdjustments,
      orders: unattributedOrderIds.size,
      amount: unattributedAmount.toFixed(2),
    },
  };
}
