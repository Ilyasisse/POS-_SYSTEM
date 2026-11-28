export type ReceiptFormat = "full" | "thermal";

export function receiptHref(orderId: string, format: ReceiptFormat) {
  const base = `/print/orders/${encodeURIComponent(orderId)}`;
  return format === "thermal" ? `${base}/thermal-receipt` : base;
}
