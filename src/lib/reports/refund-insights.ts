export type RefundAdjustment = {
  orderId: string;
  amount: string;
  orderItem: { productId: string; productName: string } | null;
};

function cents(value: string) {
  const [whole, fractional] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fractional);
}

function formatCents(value: bigint) {
  return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
}

export function summarizeRefundInsights(adjustments: RefundAdjustment[]) {
  const products = new Map<
    string,
    {
      id: string;
      name: string;
      refundedOrders: Set<string>;
      adjustments: number;
      amountCents: bigint;
    }
  >();
  let unallocatedCents = BigInt(0);
  let unallocatedAdjustments = 0;

  for (const adjustment of adjustments) {
    const amount = cents(adjustment.amount);
    if (!adjustment.orderItem) {
      unallocatedCents += amount;
      unallocatedAdjustments++;
      continue;
    }
    const { productId, productName } = adjustment.orderItem;
    const row = products.get(productId) ?? {
      id: productId,
      name: productName,
      refundedOrders: new Set<string>(),
      adjustments: 0,
      amountCents: BigInt(0),
    };
    row.refundedOrders.add(adjustment.orderId);
    row.adjustments++;
    row.amountCents += amount;
    products.set(productId, row);
  }

  return {
    totalAdjustments: adjustments.length,
    unallocatedAdjustments,
    unallocatedAmount: formatCents(unallocatedCents),
    products: [...products.values()]
      .sort(
        (a, b) =>
          b.refundedOrders.size - a.refundedOrders.size ||
          (a.amountCents > b.amountCents
            ? -1
            : a.amountCents < b.amountCents
              ? 1
              : a.name.localeCompare(b.name)),
      )
      .map(({ refundedOrders, amountCents, ...row }) => ({
        ...row,
        refundedOrders: refundedOrders.size,
        amount: formatCents(amountCents),
      })),
  };
}
